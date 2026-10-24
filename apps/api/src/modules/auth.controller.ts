import {
  BadRequestException,
  Body,
  Controller,
  HttpException,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { type Request, type Response } from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { password } from '../access';
import { checkPassword, hashPassword, tokenHash } from '../security';
import { AuthRequest, audit, command } from '../shared/commands';
import { db } from '../shared/database';
const attempts = new Map<string, { count: number; until: number }>();
const passwordAttempts = new Map<string, { count: number; until: number }>();
@Controller('api')
export class AuthController {
  @Post('auth/login') async login(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = z
      .object({ email: z.string().email().max(200), password: z.string().min(1).max(200) })
      .parse(body);
    const ip = req.ip || 'local';
    const a = attempts.get(ip);
    if (a && a.until > Date.now() && a.count >= 10)
      throw new HttpException('Demasiados intentos. Espera 15 minutos.', 429);
    const user = await db.user.findUnique({ where: { email: data.email.toLowerCase() } });
    if (!user || !user.active || !checkPassword(data.password, user.passwordHash)) {
      attempts.set(ip, {
        count: a && a.until > Date.now() ? a.count + 1 : 1,
        until: Date.now() + 900000,
      });
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }
    attempts.delete(ip);
    const token = randomBytes(32).toString('hex');
    await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    await db.session.create({
      data: {
        id: tokenHash(token),
        userId: user.id,
        expiresAt: new Date(Date.now() + 8 * 3600000),
      },
    });
    res.cookie('obra_session', token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 8 * 3600000,
      path: '/',
    });
    return { name: user.name, email: user.email, mustChangePassword: user.mustChangePassword };
  }
  @Post('auth/logout') async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await db.session.deleteMany({ where: { id: tokenHash(req.cookies.obra_session || '') } });
    res.clearCookie('obra_session', { path: '/' });
    return { ok: true };
  }
  @Post('auth/password') async changePassword(@Body() body: unknown, @Req() req: AuthRequest) {
    const v = z.object({ currentPassword: z.string().min(1).max(200), password }).parse(body);
    const attempt = passwordAttempts.get(req.actor.id);
    if (attempt && attempt.until > Date.now() && attempt.count >= 10)
      throw new HttpException('Demasiados intentos. Espera 15 minutos.', 429);
    passwordAttempts.set(req.actor.id, {
      count: attempt && attempt.until > Date.now() ? attempt.count + 1 : 1,
      until: attempt && attempt.until > Date.now() ? attempt.until : Date.now() + 900000,
    });
    return command(req, async (tx) => {
      const u = await tx.user.findUniqueOrThrow({ where: { id: req.actor.id } });
      if (!checkPassword(v.currentPassword, u.passwordHash))
        throw new BadRequestException('La contraseña actual no coincide');
      if (checkPassword(v.password, u.passwordHash))
        throw new BadRequestException('Elige una contraseña diferente');
      await tx.user.update({
        where: { id: u.id },
        data: {
          passwordHash: hashPassword(v.password),
          mustChangePassword: false,
          revision: { increment: 1 },
        },
      });
      await tx.session.deleteMany({ where: { userId: u.id } });
      await audit(tx, req, 'Contraseña actualizada', u.id, 'Sesiones revocadas');
      return { ok: true };
    });
  }
}
