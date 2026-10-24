import { HttpException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { json, type NextFunction, type Request, type Response } from 'express';
import 'reflect-metadata';
import { actorFrom, authorize, userSelect } from './access';
import { AppModule } from './app.module';
import { tokenHash } from './security';
import { AuthRequest } from './shared/commands';
import { db } from './shared/database';
import { Errors } from './shared/errors';
async function main() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
    bodyParser: false,
  });
  app.use(cookieParser());
  app.useGlobalFilters(new Errors());
  app.use(async (req: AuthRequest, res: Response, next: () => void) => {
    if (
      req.method !== 'GET' &&
      req.headers.origin &&
      req.headers.origin !== process.env.WEB_ORIGIN
    ) {
      res.status(403).json({ message: 'Origen no permitido' });
      return;
    }
    if (req.path === '/api/health' || req.path === '/api/auth/login') {
      next();
      return;
    }
    try {
      const token = req.cookies?.obra_session;
      const session = token
        ? await db.session.findUnique({
            where: { id: tokenHash(token) },
            include: { user: { select: userSelect } },
          })
        : null;
      if (!session || !session.user.active || session.expiresAt < new Date()) {
        res.status(401).json({ message: 'Inicia sesión para continuar' });
        return;
      }
      req.actor = actorFrom(session.user);
      if (
        session.user.mustChangePassword &&
        !['/api/auth/password', '/api/auth/logout'].includes(req.path)
      ) {
        res.status(403).json({
          message: 'Cambia tu contraseña temporal para continuar',
          code: 'PASSWORD_CHANGE_REQUIRED',
        });
        return;
      }
      next();
    } catch {
      res.status(503).json({ message: 'La base de datos no está disponible' });
    }
  });
  const normalJson = json({ limit: '1mb' }),
    evidenceJson = json({ limit: '12mb' }),
    planJson = json({ limit: '22mb' });
  app.use((req: Request, res: Response, next: NextFunction) =>
    (/^\/api\/(drawings(?:\/[^/]+\/versions)?|plan-issues\/[^/]+\/events)$/.test(req.path)
      ? planJson
      : /^\/api\/logs\/[^/]+\/attachments$/.test(req.path)
        ? evidenceJson
        : normalJson)(req, res, next),
  );
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (err?.type === 'entity.too.large') {
      res.status(413).json({
        message: 'Solicitud demasiado grande. Respeta los límites de archivos indicados.',
      });
      return;
    }
    if (err instanceof SyntaxError) {
      res.status(400).json({ message: 'Solicitud JSON inválida' });
      return;
    }
    next(err);
  });
  app.use(async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (['/api/health', '/api/auth/login'].includes(req.path)) {
      next();
      return;
    }
    try {
      await authorize(db, req.actor, req.method, req.path, req.body);
      next();
    } catch (e) {
      if (e instanceof HttpException) {
        res.status(e.getStatus()).json({ message: e.message });
        return;
      }
      res.status(400).json({ message: 'Solicitud no válida' });
    }
  });
  await app.listen(Number(process.env.API_PORT || 4100), '127.0.0.1');
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
