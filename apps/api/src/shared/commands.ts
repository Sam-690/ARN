import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { type Request } from 'express';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { Actor, actorFrom, authorize } from '../access';
import { db } from './database';
export type AuthRequest = Request & { actor: Actor };
export function audit(
  tx: Prisma.TransactionClient,
  req: AuthRequest,
  action: string,
  id: string,
  detail: string,
) {
  return tx.audit.create({ data: { actor: req.actor.name, action, entityId: id, detail } });
}
export async function project(tx: Prisma.TransactionClient, id: string) {
  const p = await tx.project.findUnique({ where: { id } });
  if (!p) throw new NotFoundException('Obra no encontrada');
  if (p.status !== 'ACTIVE') throw new ConflictException('La obra está cerrada');
  return p;
}
export async function command(
  req: AuthRequest,
  action: (tx: Prisma.TransactionClient) => Promise<any>,
) {
  const key = z.string().uuid().parse(req.headers['idempotency-key']);
  const fingerprint = createHash('sha256')
    .update(req.actor.id + req.path + JSON.stringify(req.body))
    .digest('hex');
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          const current = await tx.user.findUnique({
            where: { id: req.actor.id },
            include: { memberships: true },
          });
          if (!current || !current.active) throw new UnauthorizedException('Sesión revocada');
          if (current.revision !== req.actor.revision)
            throw new UnauthorizedException('Tu acceso cambió. Inicia sesión de nuevo.');
          await authorize(tx, actorFrom(current), req.method, req.path, req.body);
          const prev = await tx.command.findUnique({ where: { id: key } });
          if (prev) {
            if (prev.fingerprint !== fingerprint)
              throw new ConflictException('La solicitud ya existe con otro contenido');
            return prev.result;
          }
          const result = JSON.parse(JSON.stringify(await action(tx)));
          await tx.command.create({ data: { id: key, fingerprint, result } });
          return result;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 },
      );
    } catch (e: any) {
      if ((e.code === 'P2034' || e.code === 'P2002') && attempt < 3) continue;
      throw e;
    }
  }
}
