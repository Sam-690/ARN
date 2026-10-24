import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { z } from 'zod';
import { password, roleLabels, rolePermissions, userSchema, userSelect } from '../access';
import { hashPassword } from '../security';
import { AuthRequest, audit, command } from '../shared/commands';
import { db } from '../shared/database';
import { text } from '../shared/schemas';

@Controller('api')
export class UsersController {
  @Get('users') async users() {
    return {
      users: await db.user.findMany({ select: userSelect, orderBy: { name: 'asc' } }),
      roles: Object.entries(roleLabels).map(([id, label]) => ({
        id,
        label,
        permissions: rolePermissions[id],
      })),
    };
  }
  @Post('users') async createUser(@Body() body: unknown, @Req() req: AuthRequest) {
    const v = userSchema.extend({ password }).parse(body);
    return command(req, async (tx) => {
      if (v.projectIds.length !== (await tx.project.count({ where: { id: { in: v.projectIds } } })))
        throw new BadRequestException('Una obra ya no está disponible');
      const { password: secret, projectIds, ...fields } = v;
      const user = await tx.user.create({
        data: {
          ...fields,
          passwordHash: hashPassword(secret),
          mustChangePassword: true,
          memberships: {
            create: fields.role === 'ADMIN' ? [] : projectIds.map((projectId) => ({ projectId })),
          },
        },
        select: userSelect,
      });
      await audit(
        tx,
        req,
        'Usuario creado',
        user.id,
        `${user.email} · ${user.role} · obras: ${projectIds.join(', ')}`,
      );
      return user;
    });
  }
  @Post('users/:id') async updateUser(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    const v = userSchema
      .extend({ active: z.boolean(), expectedRevision: z.number().int().min(0), reason: text })
      .parse(body);
    return command(req, async (tx) => {
      const old = await tx.user.findUnique({ where: { id } });
      if (!old) throw new NotFoundException();
      if (old.revision !== v.expectedRevision)
        throw new ConflictException('La cuenta cambió. Actualiza la lista.');
      if (id === req.actor.id && (v.role !== 'ADMIN' || !v.active))
        throw new ConflictException(
          'No puedes quitarte la administración ni desactivar tu propia cuenta',
        );
      if (
        old.role === 'ADMIN' &&
        old.active &&
        (!v.active || v.role !== 'ADMIN') &&
        (await tx.user.count({ where: { role: 'ADMIN', active: true } })) <= 1
      )
        throw new ConflictException('Debe quedar una cuenta administradora activa');
      if (v.projectIds.length !== (await tx.project.count({ where: { id: { in: v.projectIds } } })))
        throw new BadRequestException('Una obra ya no está disponible');
      await tx.projectMember.deleteMany({ where: { userId: id } });
      const updated = await tx.user.update({
        where: { id },
        data: {
          name: v.name,
          email: v.email,
          role: v.role,
          active: v.active,
          revision: { increment: 1 },
          memberships: {
            create: v.role === 'ADMIN' ? [] : v.projectIds.map((projectId) => ({ projectId })),
          },
        },
        select: userSelect,
      });
      await tx.session.deleteMany({ where: { userId: id } });
      await audit(
        tx,
        req,
        'Acceso de usuario actualizado',
        id,
        `${old.email}: ${old.role} → ${v.role}; activa: ${v.active}; obras: ${v.projectIds.join(', ')} · ${v.reason}`,
      );
      return updated;
    });
  }
  @Post('users/:id/password') async resetUserPassword(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    const v = z
      .object({ password, expectedRevision: z.number().int().min(0), reason: text })
      .parse(body);
    return command(req, async (tx) => {
      if (id === req.actor.id)
        throw new BadRequestException('Usa Cambiar mi contraseña para tu propia cuenta');
      const u = await tx.user.findUnique({ where: { id } });
      if (!u) throw new NotFoundException();
      if (u.revision !== v.expectedRevision)
        throw new ConflictException('La cuenta cambió. Actualiza la lista.');
      const updated = await tx.user.update({
        where: { id },
        data: {
          passwordHash: hashPassword(v.password),
          mustChangePassword: true,
          revision: { increment: 1 },
        },
        select: userSelect,
      });
      await tx.session.deleteMany({ where: { userId: id } });
      await audit(tx, req, 'Contraseña temporal renovada', id, v.reason);
      return updated;
    });
  }
}
