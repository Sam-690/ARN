import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import {
  Module,
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  Res,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  Catch,
  ArgumentsHost,
  HttpException,
  ExceptionFilter,
} from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { z, ZodError } from 'zod';
import cookieParser from 'cookie-parser';
import { json, type Request, type Response, type NextFunction } from 'express';
import { attachmentMeta, decodeEvidence, transcribeAudio } from './log-evidence';
import {
  drawingInclude,
  versionMeta,
  issueInclude,
  issueEvidenceMeta,
  planFileSchema,
  issueSchema,
  issueEventSchema,
  decodePlan,
  decodeIssueEvidence,
  eventStatus,
  safeFilename,
} from './plans';
import {
  changeSchema,
  changeActionSchema,
  changeInclude,
  changeBalance,
  projectChangeSummary,
  changeStatus,
  latestProposal,
} from './changes';
import {
  documentUpload,
  documentReview,
  documentMeta,
  decodeDocument,
  documentIdentity,
  checkDocumentTotals,
  extractDocument,
} from './documents';
import {
  familySchema,
  experienceSchema,
  experienceInclude,
  experienceMetrics,
  experienceGroups,
  normalizeExperience,
} from './experience';
import { D, averageCost, moneySummary, lineTotal } from './domain';
import { createLogReport, logExportSchema } from './log-report';
import { forecast, forecastSchema, dateKey } from './forecast';
import { supplyCoverage } from './supply';
import {
  authorize,
  actorFrom,
  Actor,
  can,
  roleLabels,
  rolePermissions,
  userSelect,
  userSchema,
  password,
} from './access';
import { checkPassword, hashPassword, tokenHash } from './security';
config({ path: resolve(process.cwd(), '../../.env') });
const db = new PrismaClient();
type AuthRequest = Request & { actor: Actor };
const text = z.string().trim().min(1, 'Campo requerido').max(200);
const positive = z.coerce
  .number()
  .finite()
  .positive()
  .max(100000000)
  .refine((n) => Math.abs(n * 10000 - Math.round(n * 10000)) < 0.001, 'Máximo 4 decimales');
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) => !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
    'Fecha no válida',
  );
const optionalText = z.string().trim().max(5000).default('');
const projectSchema = z
  .object({
    code: text.max(24),
    name: text,
    client: text,
    location: text,
    manager: text,
    startDate: date,
    endDate: date,
  })
  .refine((v) => v.endDate >= v.startDate, 'La fecha final debe ser posterior a la inicial');
const materialSchema = z.object({
  code: text.max(24),
  name: text,
  unit: text.max(16),
  type: z.enum(['MATERIAL', 'LABOR', 'EQUIPMENT']),
  price: positive,
});
const componentSchema = z.object({ name: text, quantity: positive, price: positive });
const budgetSchema = z.object({
  projectId: text,
  code: text.max(24),
  name: text,
  unit: text.max(16),
  quantity: positive,
  components: z.array(componentSchema).min(1).max(100),
});
const orderSchema = z.object({
  projectId: text,
  supplier: text,
  expectedDate: date,
  lines: z
    .array(z.object({ materialId: text, quantity: positive, unitPrice: positive }))
    .min(1)
    .max(100),
});
const logSchema = z.object({
  projectId: text,
  date: date,
  title: text,
  activities: z.string().trim().min(1).max(10000),
  incident: optionalText,
  crew: z.coerce.number().int().min(0).max(10000),
  weather: text.max(50),
  front: z.string().trim().max(200).default(''),
  budgetItemId: text.optional(),
});
const includeOrder = { lines: { include: { material: true } }, payments: true, project: true };
function audit(
  tx: Prisma.TransactionClient,
  req: AuthRequest,
  action: string,
  id: string,
  detail: string,
) {
  return tx.audit.create({ data: { actor: req.actor.name, action, entityId: id, detail } });
}
async function project(tx: Prisma.TransactionClient, id: string) {
  const p = await tx.project.findUnique({ where: { id } });
  if (!p) throw new NotFoundException('Obra no encontrada');
  if (p.status !== 'ACTIVE') throw new ConflictException('La obra está cerrada');
  return p;
}
async function command(req: AuthRequest, action: (tx: Prisma.TransactionClient) => Promise<any>) {
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
@Catch()
class Errors implements ExceptionFilter {
  catch(e: any, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (e instanceof ZodError)
      return res
        .status(400)
        .json({ message: e.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join(' · ') });
    if (e instanceof HttpException) return res.status(e.getStatus()).json({ message: e.message });
    if (e.code === 'P2002')
      return res.status(409).json({ message: 'Ya existe un registro con esa clave o referencia.' });
    if (e.code === 'P2003')
      return res.status(400).json({ message: 'El registro relacionado no existe.' });
    if (e.code === 'P2025') return res.status(404).json({ message: 'Registro no encontrado.' });
    console.error(e);
    return res
      .status(500)
      .json({ message: 'No se pudo completar la operación. Intenta de nuevo.' });
  }
}
const documentAttempts = new Map<string, { count: number; until: number }>();
const transcriptionAttempts = new Map<string, { count: number; until: number }>();
const attempts = new Map<string, { count: number; until: number }>();
const exportingLogs = new Set<string>();
const passwordAttempts = new Map<string, { count: number; until: number }>();
@Controller('api')
class Api {
  @Get('health') health() {
    return { status: 'ok', version: '0.1.0' };
  }
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
  @Get('data') async data(@Req() req: AuthRequest) {
    const scope = req.actor.role === 'ADMIN' ? {} : { projectId: { in: req.actor.projectIds } },
      projectScope = req.actor.role === 'ADMIN' ? {} : { id: { in: req.actor.projectIds } };
    const transferScope =
      req.actor.role === 'ADMIN'
        ? {}
        : {
            fromProjectId: { in: req.actor.projectIds },
            toProjectId: { in: req.actor.projectIds },
          };
    const [
      projects,
      materials,
      orders,
      stocks,
      movements,
      logs,
      audits,
      needs,
      transfers,
      drawings,
      planIssues,
      changes,
      documents,
      experienceFamilies,
      experienceRecords,
      consumptionMovements,
    ] = await db.$transaction(
      [
        db.project.findMany({
          where: projectScope,
          include: { budgetItems: true },
          orderBy: { createdAt: 'desc' },
        }),
        db.material.findMany({ orderBy: { name: 'asc' } }),
        db.purchaseOrder.findMany({
          where: scope,
          include: includeOrder,
          orderBy: { createdAt: 'desc' },
        }),
        db.stock.findMany({ where: scope, include: { material: true, project: true } }),
        db.movement.findMany({
          where: scope,
          include: { material: true, project: true },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
        db.siteLog.findMany({
          where: scope,
          include: {
            project: true,
            budgetItem: true,
            attachments: { select: attachmentMeta, orderBy: { createdAt: 'asc' } },
            addenda: { orderBy: { createdAt: 'asc' } },
          },
          orderBy: { date: 'desc' },
        }),
        db.audit.findMany({
          where: req.actor.role === 'ADMIN' ? {} : { id: '__hidden__' },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
        db.supplyNeed.findMany({
          where: scope,
          include: { project: true, material: true },
          orderBy: [{ neededOn: 'asc' }, { createdAt: 'asc' }],
        }),
        db.stockTransfer.findMany({
          where: transferScope,
          include: { fromProject: true, toProject: true, material: true },
          orderBy: { createdAt: 'desc' },
        }),
        db.drawing.findMany({
          where: scope,
          include: drawingInclude,
          orderBy: { createdAt: 'desc' },
        }),
        db.planIssue.findMany({
          where: { version: { drawing: scope } },
          include: issueInclude,
          orderBy: { number: 'desc' },
        }),
        db.changeRequest.findMany({
          where: scope,
          include: changeInclude,
          orderBy: { number: 'desc' },
        }),
        db.sourceDocument.findMany({
          where: scope,
          select: documentMeta,
          orderBy: { number: 'desc' },
        }),
        db.experienceFamily.findMany({ orderBy: { createdAt: 'desc' } }),
        db.experienceRecord.findMany({
          where: scope,
          include: experienceInclude,
          orderBy: { number: 'desc' },
        }),
        db.movement.findMany({
          where: { ...scope, type: 'OUT' },
          include: {
            material: true,
            allocations: { include: { record: { select: { status: true } } } },
          },
          orderBy: { createdAt: 'desc' },
        }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return {
      experience: {
        families: experienceFamilies,
        records: experienceRecords.map((r) => ({ ...r, metrics: experienceMetrics(r) })),
        groups: experienceGroups(experienceRecords),
        byProject: Object.fromEntries(
          projects.map((p) => [
            p.id,
            experienceGroups(experienceRecords.filter((r) => r.projectId === p.id)),
          ]),
        ),
        movements: consumptionMovements.map(({ allocations, ...m }) => ({
          ...m,
          available: m.quantity
            .sub(
              allocations
                .filter((a) => a.record.status !== 'VOID')
                .reduce((s, a) => s.add(a.quantity), D(0)),
            )
            .toFixed(4),
        })),
      },
      documents,
      capabilities: {
        documentExtraction: Boolean(
          process.env.OPENAI_API_KEY && process.env.DOCUMENT_EXTRACTION_MODEL,
        ),
        transcription: Boolean(process.env.OPENAI_API_KEY),
      },
      user: {
        ...req.actor,
        roleLabel: roleLabels[req.actor.role as keyof typeof roleLabels],
        permissions: rolePermissions[req.actor.role] || [],
      },
      projects: projects.map((p) => ({ ...p, changeSummary: projectChangeSummary(p, changes) })),
      materials,
      orders: orders.map((o) => ({ ...o, ...moneySummary(o) })),
      stocks,
      movements,
      logs,
      audits,
      needs,
      transfers,
      drawings,
      planIssues,
      changes: changes.map((c) => ({ ...c, ...changeBalance(c) })),
      coverage: supplyCoverage(
        needs,
        stocks,
        orders,
        new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' }),
      ),
    };
  }
  @Post('supply/forecast') async forecastSupply(@Body() body: unknown, @Req() req: AuthRequest) {
    const v = forecastSchema.parse(body);
    const scope = req.actor.role === 'ADMIN' ? {} : { projectId: { in: req.actor.projectIds } };
    return db.$transaction(
      async (tx) => {
        const p = await tx.project.findUnique({ where: { id: v.projectId } });
        if (!p) throw new NotFoundException('Obra no encontrada');
        const m = await tx.material.findUnique({ where: { id: v.materialId } });
        if (!m || m.type !== 'MATERIAL')
          throw new BadRequestException('Selecciona un material del catálogo');
        const [movements, stocks, orders, needs] = await Promise.all([
          tx.movement.findMany({ where: { ...scope, type: { in: ['OUT', 'IN'] } } }),
          tx.stock.findMany({
            where: { ...scope, materialId: v.materialId },
            include: { project: true },
          }),
          tx.purchaseOrder.findMany({ where: scope, include: { lines: true } }),
          tx.supplyNeed.findMany({
            where: { projectId: v.projectId, materialId: v.materialId, status: 'OPEN' },
          }),
        ]);
        return forecast(v, dateKey(new Date()), p.startDate, movements, stocks, orders, needs);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  @Post('projects') async createProject(@Body() b: unknown, @Req() req: AuthRequest) {
    const v = projectSchema.parse(b);
    return command(req, async (tx) => {
      const p = await tx.project.create({
        data: {
          ...v,
          code: v.code.toUpperCase(),
          startDate: new Date(v.startDate),
          endDate: new Date(v.endDate),
        },
      });
      await audit(tx, req, 'Obra creada', p.id, p.name);
      return p;
    });
  }
  @Post('projects/:id/close') async closeProject(@Param('id') id: string, @Req() req: AuthRequest) {
    return command(req, async (tx) => {
      await project(tx, id);
      const orders = await tx.purchaseOrder.findMany({
        where: { projectId: id },
        include: includeOrder,
      });
      if (
        orders.some(
          (o) =>
            o.status !== 'CANCELLED' &&
            (o.status === 'DRAFT' ||
              D(moneySummary(o).committed).gt(0) ||
              D(moneySummary(o).due).gt(0)),
        )
      )
        throw new ConflictException('Hay compras abiertas o pagos pendientes');
      const stocks = await tx.stock.findMany({ where: { projectId: id, quantity: { gt: 0 } } });
      if (stocks.length) throw new ConflictException('Hay existencias por consumir en esta obra');
      if (await tx.supplyNeed.count({ where: { projectId: id, status: 'OPEN' } }))
        throw new ConflictException('Hay necesidades de abastecimiento abiertas');
      if (
        await tx.stockTransfer.count({
          where: { status: 'IN_TRANSIT', OR: [{ fromProjectId: id }, { toProjectId: id }] },
        })
      )
        throw new ConflictException('Hay traspasos en tránsito');
      if (
        await tx.planIssue.count({
          where: { version: { drawing: { projectId: id } }, status: { not: 'RESOLVED' } },
        })
      )
        throw new ConflictException('Hay incidencias de planos sin resolver');
      if (await tx.siteLog.count({ where: { projectId: id, status: 'DRAFT' } }))
        throw new ConflictException('Hay bitácoras en borrador');
      const changes = await tx.changeRequest.findMany({
        where: { projectId: id },
        include: changeInclude,
      });
      if (
        changes.some(
          (c) =>
            ['DRAFT', 'SUBMITTED', 'REJECTED'].includes(c.status) ||
            (c.status === 'APPROVED' &&
              (c.progress < 100 || D(changeBalance(c).outstanding).gt(0))),
        )
      )
        throw new ConflictException(
          'Hay cambios de obra pendientes de decisión, ejecución o liquidación',
        );
      const p = await tx.project.update({ where: { id }, data: { status: 'CLOSED' } });
      await audit(tx, req, 'Obra cerrada', id, p.name);
      return p;
    });
  }
  @Post('materials') async createMaterial(@Body() b: unknown, @Req() req: AuthRequest) {
    const v = materialSchema.parse(b);
    return command(req, async (tx) => {
      const m = await tx.material.create({ data: { ...v, code: v.code.toUpperCase() } });
      await audit(tx, req, 'Insumo creado', m.id, m.name);
      return m;
    });
  }
  @Post('budget') async createBudget(@Body() b: unknown, @Req() req: AuthRequest) {
    const v = budgetSchema.parse(b);
    return command(req, async (tx) => {
      const p = await project(tx, v.projectId);
      if (p.budgetApproved) throw new ConflictException('El presupuesto aprobado está congelado');
      const unitPrice = v.components
        .reduce((s, c) => s.add(D(c.quantity).mul(c.price)), D(0))
        .toDecimalPlaces(4);
      if (unitPrice.gte('100000000000000'))
        throw new BadRequestException('El precio unitario excede la precisión admitida');
      const item = await tx.budgetItem.create({ data: { ...v, unitPrice } });
      await audit(tx, req, 'Concepto agregado', p.id, v.name);
      return item;
    });
  }
  @Post('projects/:id/approve-budget') async approveBudget(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ) {
    return command(req, async (tx) => {
      const p = await project(tx, id);
      if (p.budgetApproved) throw new ConflictException('El presupuesto ya fue aprobado');
      if (!(await tx.budgetItem.count({ where: { projectId: id } })))
        throw new ConflictException('Agrega al menos un concepto');
      const updated = await tx.project.update({ where: { id }, data: { budgetApproved: true } });
      await audit(tx, req, 'Presupuesto aprobado', id, p.name);
      return updated;
    });
  }
  @Post('orders') async createOrder(@Body() b: unknown, @Req() req: AuthRequest) {
    const v = orderSchema.parse(b);
    return command(req, async (tx) => {
      await project(tx, v.projectId);
      for (const line of v.lines) {
        const m = await tx.material.findUnique({ where: { id: line.materialId } });
        if (!m || m.type !== 'MATERIAL')
          throw new BadRequestException('Esta versión de compras admite materiales del catálogo');
      }
      const o = await tx.purchaseOrder.create({
        data: {
          projectId: v.projectId,
          supplier: v.supplier,
          expectedDate: new Date(v.expectedDate),
          lines: { create: v.lines },
        },
        include: includeOrder,
      });
      await audit(tx, req, 'Compra creada', o.id, `OC-${o.number} · ${o.supplier}`);
      return o;
    });
  }
  @Post('orders/:id/approve') async approveOrder(@Param('id') id: string, @Req() req: AuthRequest) {
    return command(req, async (tx) => {
      const o = await tx.purchaseOrder.findUnique({ where: { id } });
      if (!o) throw new NotFoundException();
      await project(tx, o.projectId);
      if (o.status !== 'DRAFT') throw new ConflictException('Solo se aprueban borradores');
      const updated = await tx.purchaseOrder.update({
        where: { id },
        data: { status: 'APPROVED' },
      });
      await audit(tx, req, 'Compra aprobada', id, `OC-${o.number}`);
      return updated;
    });
  }
  @Post('orders/:id/cancel') async cancel(@Param('id') id: string, @Req() req: AuthRequest) {
    return command(req, async (tx) => {
      const o = await tx.purchaseOrder.findUnique({ where: { id }, include: includeOrder });
      if (!o) throw new NotFoundException();
      await project(tx, o.projectId);
      if (o.status === 'CANCELLED' || o.lines.some((l) => l.received.gt(0)) || o.payments.length)
        throw new ConflictException('Solo puedes cancelar compras sin recepciones ni pagos');
      const updated = await tx.purchaseOrder.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
      await audit(tx, req, 'Compra cancelada', id, `OC-${o.number}`);
      return updated;
    });
  }
  @Post('orders/:id/receive') async receive(
    @Param('id') id: string,
    @Body() b: unknown,
    @Req() req: AuthRequest,
  ) {
    const v = z.object({ lineId: text, quantity: positive, reference: text }).parse(b);
    return command(req, async (tx) => {
      const o = await tx.purchaseOrder.findUnique({ where: { id }, include: includeOrder });
      if (!o) throw new NotFoundException();
      await project(tx, o.projectId);
      if (!['APPROVED', 'PARTIAL'].includes(o.status))
        throw new ConflictException('La orden no admite recepciones');
      const l = o.lines.find((l) => l.id === v.lineId);
      if (!l) throw new BadRequestException('Partida no encontrada');
      if (l.received.add(v.quantity).gt(l.quantity))
        throw new ConflictException('La recepción excede la cantidad pendiente');
      const stock = await tx.stock.findUnique({
        where: { projectId_materialId: { projectId: o.projectId, materialId: l.materialId } },
      });
      const avg = averageCost(
        stock?.quantity || 0,
        stock?.averageCost || 0,
        v.quantity,
        l.unitPrice,
      );
      await tx.stock.upsert({
        where: { projectId_materialId: { projectId: o.projectId, materialId: l.materialId } },
        create: {
          projectId: o.projectId,
          materialId: l.materialId,
          quantity: v.quantity,
          averageCost: avg,
        },
        update: { quantity: { increment: v.quantity }, averageCost: avg },
      });
      await tx.orderLine.update({
        where: { id: l.id },
        data: { received: { increment: v.quantity } },
      });
      await tx.movement.create({
        data: {
          projectId: o.projectId,
          materialId: l.materialId,
          type: 'IN',
          quantity: v.quantity,
          unitCost: l.unitPrice,
          reference: `OC-${o.number} · ${v.reference}`,
        },
      });
      const completed = o.lines.every((x) =>
        x.id === l.id ? x.received.add(v.quantity).eq(x.quantity) : x.received.eq(x.quantity),
      );
      const updated = await tx.purchaseOrder.update({
        where: { id },
        data: { status: completed ? 'RECEIVED' : 'PARTIAL' },
      });
      await audit(
        tx,
        req,
        'Material recibido',
        id,
        `${v.quantity} ${l.material.unit} · ${l.material.name}`,
      );
      return updated;
    });
  }
  @Post('stock/consume') async consume(@Body() b: unknown, @Req() req: AuthRequest) {
    const v = z
      .object({
        projectId: text,
        materialId: text,
        quantity: positive,
        reference: text,
        needId: text.optional(),
      })
      .parse(b);
    return command(req, async (tx) => {
      await project(tx, v.projectId);
      const s = await tx.stock.findUnique({
        where: { projectId_materialId: { projectId: v.projectId, materialId: v.materialId } },
      });
      if (!s || s.quantity.sub(s.released).lt(v.quantity))
        throw new ConflictException(
          'Existencia utilizable insuficiente. Retira la liberación de sobrantes si corresponde.',
        );
      if (v.needId) {
        const need = await tx.supplyNeed.findUnique({ where: { id: v.needId } });
        if (
          !need ||
          need.projectId !== v.projectId ||
          need.materialId !== v.materialId ||
          need.status !== 'OPEN'
        )
          throw new ConflictException(
            'La necesidad no corresponde a este material y obra o ya está cerrada',
          );
        if (need.consumed.add(v.quantity).gt(need.quantity))
          throw new ConflictException('El consumo excede la necesidad pendiente');
        await tx.supplyNeed.update({
          where: { id: need.id },
          data: {
            consumed: { increment: v.quantity },
            status: need.consumed.add(v.quantity).eq(need.quantity) ? 'FULFILLED' : 'OPEN',
          },
        });
      }
      await tx.stock.update({ where: { id: s.id }, data: { quantity: { decrement: v.quantity } } });
      const m = await tx.movement.create({ data: { ...v, type: 'OUT', unitCost: s.averageCost } });
      await audit(tx, req, 'Salida de material', m.id, v.reference);
      return m;
    });
  }
  @Post('orders/:id/pay') async pay(
    @Param('id') id: string,
    @Body() b: unknown,
    @Req() req: AuthRequest,
  ) {
    const v = z
      .object({
        amount: positive.refine(
          (n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.001,
          'Máximo 2 decimales',
        ),
        reference: text,
        method: z.enum(['Transferencia', 'Efectivo', 'Cheque']),
        paidAt: date,
      })
      .parse(b);
    return command(req, async (tx) => {
      const o = await tx.purchaseOrder.findUnique({ where: { id }, include: includeOrder });
      if (!o) throw new NotFoundException();
      await project(tx, o.projectId);
      if (!['PARTIAL', 'RECEIVED'].includes(o.status) || D(v.amount).gt(moneySummary(o).due))
        throw new ConflictException('El pago excede el saldo recibido pendiente');
      const p = await tx.payment.create({
        data: { ...v, orderId: id, paidAt: new Date(v.paidAt) },
      });
      await audit(tx, req, 'Pago registrado', id, `OC-${o.number} · $${v.amount} · ${v.reference}`);
      return p;
    });
  }
  @Post('supply/needs') async createNeed(@Body() b: unknown, @Req() req: AuthRequest) {
    const v = z
      .object({
        projectId: text,
        materialId: text,
        quantity: positive,
        neededOn: date,
        leadDays: z.coerce.number().int().min(0).max(365),
        purpose: text,
      })
      .parse(b);
    return command(req, async (tx) => {
      await project(tx, v.projectId);
      const m = await tx.material.findUnique({ where: { id: v.materialId } });
      if (!m || m.type !== 'MATERIAL')
        throw new BadRequestException('Selecciona un material del catálogo');
      const need = await tx.supplyNeed.create({ data: { ...v, neededOn: new Date(v.neededOn) } });
      await audit(
        tx,
        req,
        'Necesidad planificada',
        need.id,
        `${v.quantity} ${m.unit} · ${m.name} · ${v.purpose}`,
      );
      return need;
    });
  }
  @Post('supply/needs/:id/cancel') async cancelNeed(
    @Param('id') id: string,
    @Body() b: unknown,
    @Req() req: AuthRequest,
  ) {
    const v = z.object({ reason: text }).parse(b);
    return command(req, async (tx) => {
      const need = await tx.supplyNeed.findUnique({ where: { id } });
      if (!need) throw new NotFoundException('Necesidad no encontrada');
      await project(tx, need.projectId);
      if (need.status !== 'OPEN') throw new ConflictException('La necesidad ya está cerrada');
      const result = await tx.supplyNeed.update({ where: { id }, data: { status: 'CANCELLED' } });
      await audit(tx, req, 'Necesidad cancelada', id, v.reason);
      return result;
    });
  }
  @Post('stock/release') async releaseStock(@Body() b: unknown, @Req() req: AuthRequest) {
    const v = z
      .object({
        projectId: text,
        materialId: text,
        quantity: z.coerce
          .number()
          .finite()
          .min(0)
          .max(100000000)
          .refine((n) => Math.abs(n * 10000 - Math.round(n * 10000)) < 0.001, 'Máximo 4 decimales'),
        reason: text,
      })
      .parse(b);
    return command(req, async (tx) => {
      await project(tx, v.projectId);
      const stock = await tx.stock.findUnique({
        where: { projectId_materialId: { projectId: v.projectId, materialId: v.materialId } },
      });
      if (!stock || stock.quantity.lt(v.quantity))
        throw new ConflictException('La cantidad liberada excede la existencia');
      const updated = await tx.stock.update({
        where: { id: stock.id },
        data: { released: v.quantity },
      });
      await audit(
        tx,
        req,
        'Sobrante actualizado',
        stock.id,
        `${stock.released} → ${v.quantity} · ${v.reason}`,
      );
      return updated;
    });
  }
  @Post('stock/transfers') async dispatchTransfer(@Body() b: unknown, @Req() req: AuthRequest) {
    const v = z
      .object({
        fromProjectId: text,
        toProjectId: text,
        materialId: text,
        quantity: positive,
        reference: text,
      })
      .refine((v) => v.fromProjectId !== v.toProjectId, 'Selecciona dos obras diferentes')
      .parse(b);
    return command(req, async (tx) => {
      await project(tx, v.fromProjectId);
      await project(tx, v.toProjectId);
      const stock = await tx.stock.findUnique({
        where: { projectId_materialId: { projectId: v.fromProjectId, materialId: v.materialId } },
      });
      if (!stock || stock.released.lt(v.quantity))
        throw new ConflictException('No hay suficiente sobrante liberado para despachar');
      const transfer = await tx.stockTransfer.create({
        data: { ...v, unitCost: stock.averageCost, dispatchedBy: req.actor.name },
      });
      await tx.stock.update({
        where: { id: stock.id },
        data: { quantity: { decrement: v.quantity }, released: { decrement: v.quantity } },
      });
      await tx.movement.create({
        data: {
          projectId: v.fromProjectId,
          materialId: v.materialId,
          quantity: v.quantity,
          unitCost: stock.averageCost,
          type: 'TRANSFER_OUT',
          reference: `TR-${transfer.number} · ${v.reference}`,
        },
      });
      await audit(
        tx,
        req,
        'Traspaso despachado',
        transfer.id,
        `TR-${transfer.number} · ${v.quantity} · ${v.fromProjectId} → ${v.toProjectId}`,
      );
      return transfer;
    });
  }
  @Post('stock/transfers/:id/receive') async receiveTransfer(
    @Param('id') id: string,
    @Body() b: unknown,
    @Req() req: AuthRequest,
  ) {
    const v = z.object({ reference: text }).parse(b);
    return command(req, async (tx) => {
      const transfer = await tx.stockTransfer.findUnique({ where: { id } });
      if (!transfer) throw new NotFoundException('Traspaso no encontrado');
      if (transfer.status !== 'IN_TRANSIT')
        throw new ConflictException('El traspaso ya fue recibido');
      await project(tx, transfer.toProjectId);
      await project(tx, transfer.fromProjectId);
      const where = {
        projectId_materialId: { projectId: transfer.toProjectId, materialId: transfer.materialId },
      };
      const stock = await tx.stock.findUnique({ where });
      const avg = averageCost(
        stock?.quantity || 0,
        stock?.averageCost || 0,
        transfer.quantity,
        transfer.unitCost,
      );
      await tx.stock.upsert({
        where,
        create: {
          projectId: transfer.toProjectId,
          materialId: transfer.materialId,
          quantity: transfer.quantity,
          averageCost: avg,
        },
        update: { quantity: { increment: transfer.quantity }, averageCost: avg },
      });
      await tx.movement.create({
        data: {
          projectId: transfer.toProjectId,
          materialId: transfer.materialId,
          quantity: transfer.quantity,
          unitCost: transfer.unitCost,
          type: 'TRANSFER_IN',
          reference: `TR-${transfer.number} · ${v.reference}`,
        },
      });
      const updated = await tx.stockTransfer.update({
        where: { id },
        data: {
          status: 'RECEIVED',
          receivedAt: new Date(),
          receivedBy: req.actor.name,
          receiptReference: v.reference,
        },
      });
      await audit(tx, req, 'Traspaso recibido', id, `TR-${transfer.number} · ${v.reference}`);
      return updated;
    });
  }

  @Post('changes') async createChange(@Body() body: unknown, @Req() req: AuthRequest) {
    const v = changeSchema.parse(body);
    return command(req, async (tx) => {
      await project(tx, v.projectId);
      if ((await tx.changeRequest.count({ where: { projectId: v.projectId } })) >= 200)
        throw new ConflictException('Máximo 200 cambios por obra');
      const result = await tx.changeRequest.create({
        data: {
          projectId: v.projectId,
          title: v.title,
          reason: v.reason,
          author: req.actor.name,
          proposals: { create: { ...v.proposal, number: 1, author: req.actor.name } },
          events: {
            create: { action: 'CREATED', note: v.reason, actor: req.actor.name, proposalNumber: 1 },
          },
        },
        include: changeInclude,
      });
      await audit(tx, req, 'Cambio de obra registrado', result.id, 'CAM-' + result.number);
      return result;
    });
  }
  @Post('changes/:id/actions') async changeAction(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    const v = changeActionSchema.parse(body);
    return command(req, async (tx) => {
      const change = await tx.changeRequest.findUnique({ where: { id }, include: changeInclude });
      if (!change) throw new NotFoundException('Cambio no encontrado');
      await project(tx, change.projectId);
      if (change.revision !== v.expectedRevision)
        throw new ConflictException(
          'El cambio fue actualizado. Recarga los datos antes de continuar.',
        );
      if (change.events.length >= 200) throw new ConflictException('Máximo 200 eventos por cambio');
      const status = changeStatus(change.status, v.action),
        proposal = latestProposal(change)!;
      if (v.action === 'REVISE' && !v.proposal)
        throw new BadRequestException('Completa la nueva propuesta');
      if (v.action === 'REVISE' && change.proposals.length >= 30)
        throw new ConflictException('Máximo 30 revisiones por cambio');
      if (v.action === 'APPROVE') {
        if (!v.authorizationBy || !v.authorizationReference)
          throw new BadRequestException('Registra quién autorizó y la referencia de autorización');
        const p = await tx.project.findUniqueOrThrow({
          where: { id: change.projectId },
          include: { budgetItems: true },
        });
        if (!p.budgetApproved)
          throw new ConflictException('Aprueba primero la línea base del presupuesto');
        const approved = await tx.changeRequest.findMany({
          where: { projectId: p.id, status: 'APPROVED' },
          include: changeInclude,
        });
        const summary = projectChangeSummary(p, [...approved, { ...change, status: 'APPROVED' }]);
        if (D(summary.adjustedBudget).lt(0))
          throw new ConflictException('El presupuesto ajustado no puede ser negativo');
        if (new Date(summary.adjustedEndDate) < p.startDate)
          throw new ConflictException(
            'El término ajustado no puede ser anterior al inicio de obra',
          );
      }
      if (v.action === 'PROGRESS' && v.progress === undefined)
        throw new BadRequestException('Indica el avance de ejecución');
      if (v.action === 'SETTLEMENT') {
        if (!v.amount || !v.reference || !v.date)
          throw new BadRequestException('Indica importe, fecha y referencia');
        const remaining = D(changeBalance(change).outstanding);
        if (D(v.amount).gt(remaining))
          throw new ConflictException('El importe supera el saldo del cambio aprobado');
        await tx.changeSettlement.create({
          data: {
            changeId: id,
            amount: v.amount,
            reference: v.reference,
            date: new Date(v.date),
            note: v.note,
            actor: req.actor.name,
          },
        });
      }
      const proposalNumber = v.action === 'REVISE' ? proposal.number + 1 : proposal.number;
      const result = await tx.changeRequest.update({
        where: { id },
        data: {
          status,
          revision: { increment: 1 },
          ...(v.action === 'PROGRESS' ? { progress: v.progress } : {}),
          ...(v.action === 'REVISE'
            ? {
                proposals: {
                  create: { ...v.proposal!, number: proposalNumber, author: req.actor.name },
                },
              }
            : {}),
          events: {
            create: {
              action: v.action,
              note: v.note,
              actor: req.actor.name,
              proposalNumber,
              ...(v.action === 'PROGRESS' ? { progress: v.progress } : {}),
              ...(v.action === 'APPROVE'
                ? {
                    authorizationBy: v.authorizationBy,
                    authorizationReference: v.authorizationReference,
                  }
                : {}),
            },
          },
        },
        include: changeInclude,
      });
      await audit(
        tx,
        req,
        'Cambio de obra actualizado',
        id,
        'CAM-' + change.number + ' · ' + v.action,
      );
      return { ...result, ...changeBalance(result) };
    });
  }
  @Post('experience/families') async createExperienceFamily(
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    const v = familySchema.parse(body);
    return command(req, async (tx) => {
      if ((await tx.experienceFamily.count()) >= 300)
        throw new ConflictException('Máximo 300 versiones de grupos en este piloto');
      const f = await tx.experienceFamily.create({ data: { ...v, author: req.actor.name } });
      await audit(tx, req, 'Grupo de experiencia creado', f.id, `${f.code} · ${f.version}`);
      return f;
    });
  }
  @Post('experience/records') async createExperience(
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    const v = experienceSchema.parse(body);
    return command(req, async (tx) => {
      const p = await project(tx, v.projectId);
      if (!p.budgetApproved)
        throw new ConflictException('Aprueba la línea base antes de registrar experiencia');
      const item = await tx.budgetItem.findUnique({ where: { id: v.budgetItemId } }),
        family = await tx.experienceFamily.findUnique({ where: { id: v.familyId } });
      if (!item || item.projectId !== v.projectId)
        throw new BadRequestException('El concepto no pertenece a la obra');
      if (!family || normalizeExperience(family.unit) !== normalizeExperience(item.unit))
        throw new BadRequestException(
          'El grupo debe tener la misma unidad del concepto; no se convierten unidades automáticamente',
        );
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
      if (v.endDate > today || v.startDate < p.startDate.toISOString().slice(0, 10))
        throw new BadRequestException('El periodo debe estar entre el inicio de la obra y hoy');
      if ((await tx.experienceRecord.count({ where: { projectId: v.projectId } })) >= 500)
        throw new ConflictException('Máximo 500 registros por obra en este piloto');
      const frontKey = normalizeExperience(v.front);
      if (
        await tx.experienceRecord.count({
          where: {
            projectId: v.projectId,
            budgetItemId: v.budgetItemId,
            frontKey,
            isTest: v.isTest,
            status: { not: 'VOID' },
            startDate: { lte: new Date(v.endDate) },
            endDate: { gte: new Date(v.startDate) },
          },
        })
      )
        throw new ConflictException(
          'Ya hay un registro vigente de este concepto y frente en ese periodo. Anúlalo con motivo si es una corrección.',
        );
      const allocations = [];
      for (const a of v.allocations) {
        const m = await tx.movement.findUnique({
          where: { id: a.movementId },
          include: { allocations: { include: { record: { select: { status: true } } } } },
        });
        if (!m || m.projectId !== p.id || m.type !== 'OUT')
          throw new BadRequestException('Solo se asignan salidas de consumo de esta obra');
        const day = m.createdAt.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
        if (day < v.startDate || day > v.endDate)
          throw new BadRequestException('La salida debe estar dentro del periodo del registro');
        const used = m.allocations
          .filter((x) => x.record.status !== 'VOID')
          .reduce((s, x) => s.add(x.quantity), D(0));
        if (used.add(a.quantity).gt(m.quantity))
          throw new ConflictException('Una salida no tiene suficiente cantidad sin asignar');
        allocations.push({ movementId: m.id, quantity: a.quantity, unitCost: m.unitCost });
      }
      const snapshot = JSON.parse(JSON.stringify(item)),
        budgetHash = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
      const { confirmed, ...values } = v;
      const record = await tx.experienceRecord.create({
        data: {
          ...values,
          reference: normalizeExperience(v.reference),
          frontKey,
          startDate: new Date(v.startDate),
          endDate: new Date(v.endDate),
          plannedUnitPrice: item.unitPrice,
          budgetSnapshot: snapshot,
          budgetHash,
          author: req.actor.name,
          allocations: { create: allocations },
          events: { create: { action: 'CREATE', note: v.note, actor: req.actor.name } },
        },
        include: experienceInclude,
      });
      await audit(
        tx,
        req,
        'Ejecución registrada',
        record.id,
        `EXP-${record.number} · ${v.quantity} ${item.unit}${v.isTest ? ' · prueba' : ''}`,
      );
      return { ...record, metrics: experienceMetrics(record) };
    });
  }
  @Post('experience/records/:id/actions') async experienceAction(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    const v = z
      .object({
        action: z.enum(['VALIDATE', 'WITHDRAW', 'VOID']),
        expectedRevision: z.number().int().min(0),
        note: z.string().trim().min(1).max(2000),
        confirmed: z.literal(true),
      })
      .parse(body);
    return command(req, async (tx) => {
      const r = await tx.experienceRecord.findUnique({ where: { id }, include: experienceInclude });
      if (!r) throw new NotFoundException();
      await project(tx, r.projectId);
      if (r.revision !== v.expectedRevision || r.status === 'VOID')
        throw new ConflictException('El registro cambió o ya está anulado. Actualiza los datos.');
      let status = 'VOID';
      if (v.action === 'VALIDATE') {
        if (r.status !== 'RECORDED' || r.isTest)
          throw new ConflictException('Solo puedes validar registros reales pendientes');
        status = 'VALIDATED';
      }
      if (v.action === 'WITHDRAW') {
        if (r.status !== 'VALIDATED') throw new ConflictException('La muestra no está validada');
        status = 'RECORDED';
      }
      const result = await tx.experienceRecord.update({
        where: { id },
        data: {
          status,
          revision: { increment: 1 },
          events: { create: { action: v.action, note: v.note, actor: req.actor.name } },
        },
        include: experienceInclude,
      });
      await audit(tx, req, 'Experiencia actualizada', id, `${v.action} · ${v.note}`);
      return { ...result, metrics: experienceMetrics(result) };
    });
  }

  @Post('documents') async uploadDocument(@Body() body: unknown, @Req() req: AuthRequest) {
    const v = documentUpload.parse(body),
      file = await decodeDocument(v);
    return command(req, async (tx) => {
      await project(tx, v.projectId);
      const duplicate = await tx.sourceDocument.findUnique({ where: { sha256: file.sha256 } });
      if (duplicate)
        throw new ConflictException(
          `Este archivo ya existe como DOC-${duplicate.number}. Consulta el registro original.`,
        );
      if ((await tx.sourceDocument.count({ where: { projectId: v.projectId } })) >= 200)
        throw new ConflictException('Máximo 200 documentos por obra en este piloto');
      const d = await tx.sourceDocument.create({
        data: {
          projectId: v.projectId,
          ...file,
          author: req.actor.name,
          events: {
            create: {
              action: 'UPLOAD',
              note: 'Original conservado; pendiente de revisión',
              actor: req.actor.name,
            },
          },
        },
        select: documentMeta,
      });
      await audit(tx, req, 'Documento guardado', d.id, d.name);
      return d;
    });
  }
  @Get('documents/:id/file') async documentFile(@Param('id') id: string, @Res() res: Response) {
    const d = await db.sourceDocument.findUnique({ where: { id } });
    if (!d) throw new NotFoundException();
    res.set({
      'Content-Type': d.mime,
      'Content-Length': String(d.size),
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(d.name)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(Buffer.from(d.content));
  }
  @Post('documents/:id/extract') async readDocument(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    const v = z
        .object({ consent: z.literal(true), expectedRevision: z.number().int().min(0) })
        .parse(body),
      key = process.env.OPENAI_API_KEY,
      model = process.env.DOCUMENT_EXTRACTION_MODEL;
    if (!key || !model)
      throw new HttpException(
        'La lectura automática no está configurada. Puedes capturar los datos manualmente.',
        503,
      );
    const attempt = documentAttempts.get(req.actor.id);
    if (attempt && attempt.until > Date.now() && attempt.count >= 10)
      throw new HttpException('Límite de 10 lecturas por hora. Intenta más tarde.', 429);
    const startedAt = new Date();
    const file = await db.$transaction(
      async (tx) => {
        const d = await tx.sourceDocument.findUnique({ where: { id } });
        if (!d) throw new NotFoundException();
        await project(tx, d.projectId);
        if (d.status !== 'DRAFT' || d.revision !== v.expectedRevision)
          throw new ConflictException('El documento cambió. Actualiza los datos.');
        if (
          d.extractionStatus === 'PROCESSING' &&
          d.extractionStartedAt &&
          Date.now() - d.extractionStartedAt.getTime() < 120000
        )
          throw new ConflictException('La lectura está en curso. Actualiza en unos momentos.');
        await tx.sourceDocument.update({
          where: { id },
          data: {
            extractionStatus: 'PROCESSING',
            extractionStartedAt: startedAt,
            revision: { increment: 1 },
          },
        });
        return d;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    documentAttempts.set(req.actor.id, {
      count: attempt && attempt.until > Date.now() ? attempt.count + 1 : 1,
      until: attempt && attempt.until > Date.now() ? attempt.until : Date.now() + 3600000,
    });
    try {
      const extracted = await extractDocument(file, key, model);
      return await db.$transaction(async (tx) => {
        await project(tx, file.projectId);
        const updated = await tx.sourceDocument.updateMany({
          where: {
            id,
            revision: v.expectedRevision + 1,
            status: 'DRAFT',
            extractionStartedAt: startedAt,
          },
          data: {
            extracted,
            reviewed: Prisma.DbNull,
            extractionStatus: 'READY',
            revision: { increment: 1 },
          },
        });
        if (!updated.count)
          throw new ConflictException(
            'El documento cambió durante la lectura. Se conservó tu revisión.',
          );
        await tx.documentEvent.create({
          data: {
            documentId: id,
            action: 'EXTRACT',
            note: `Lectura con ${model}; todos los campos requieren revisión`,
            actor: req.actor.name,
            snapshot: extracted,
          },
        });
        return { ok: true };
      });
    } catch (e) {
      await db.sourceDocument.updateMany({
        where: { id, revision: v.expectedRevision + 1, extractionStartedAt: startedAt },
        data: { extractionStatus: 'ERROR', revision: { increment: 1 } },
      });
      throw e;
    }
  }
  @Post('documents/:id/review') async reviewDocument(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    const v = z
      .object({
        expectedRevision: z.number().int().min(0),
        confirmed: z.literal(true),
        review: documentReview,
      })
      .parse(body);
    checkDocumentTotals(v.review);
    return command(req, async (tx) => {
      const d = await tx.sourceDocument.findUnique({ where: { id } });
      if (!d) throw new NotFoundException();
      await project(tx, d.projectId);
      if (d.status !== 'DRAFT' || d.revision !== v.expectedRevision)
        throw new ConflictException('El documento cambió o ya fue revisado. Actualiza los datos.');
      for (const l of v.review.lines) {
        const m = await tx.material.findUnique({ where: { id: l.materialId } });
        if (
          !m ||
          m.type !== 'MATERIAL' ||
          m.unit.trim().toLowerCase() !== l.unit.trim().toLowerCase()
        )
          throw new BadRequestException(
            'Cada partida debe corresponder a un material y su unidad de catálogo. Ajusta cantidades y precios si hay conversión.',
          );
      }
      const identityKey = documentIdentity(v.review);
      const duplicate = await tx.sourceDocument.findUnique({ where: { identityKey } });
      if (duplicate && duplicate.id !== id)
        throw new ConflictException(
          `Proveedor, tipo y folio ya registrados en DOC-${duplicate.number}`,
        );
      const updated = await tx.sourceDocument.update({
        where: { id },
        data: {
          reviewed: v.review,
          identityKey,
          status: 'REVIEWED',
          revision: { increment: 1 },
          events: {
            create: {
              action: 'REVIEW',
              actor: req.actor.name,
              note: v.review.note,
              snapshot: v.review,
            },
          },
        },
        select: documentMeta,
      });
      await audit(tx, req, 'Documento revisado', id, `${v.review.supplier} · ${v.review.folio}`);
      return updated;
    });
  }
  @Post('documents/:id/reopen') async reopenDocument(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    const v = z.object({ expectedRevision: z.number().int(), note: text }).parse(body);
    return command(req, async (tx) => {
      const d = await tx.sourceDocument.findUnique({ where: { id } });
      if (!d) throw new NotFoundException();
      await project(tx, d.projectId);
      if (d.status !== 'REVIEWED' || d.revision !== v.expectedRevision)
        throw new ConflictException('Solo se puede corregir un documento revisado sin aplicar');
      return tx.sourceDocument.update({
        where: { id },
        data: {
          status: 'DRAFT',
          revision: { increment: 1 },
          events: { create: { action: 'REOPEN', note: v.note, actor: req.actor.name } },
        },
        select: documentMeta,
      });
    });
  }
  @Post('documents/:id/apply') async applyDocument(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    const v = z
      .object({
        expectedRevision: z.number().int().min(0),
        confirmed: z.literal(true),
        expectedDate: date.optional(),
        orderId: text.optional(),
        lineIds: z.array(text).max(100).optional(),
      })
      .parse(body);
    return command(req, async (tx) => {
      const d = await tx.sourceDocument.findUnique({ where: { id } });
      if (!d) throw new NotFoundException();
      await project(tx, d.projectId);
      if (d.status !== 'REVIEWED' || d.revision !== v.expectedRevision)
        throw new ConflictException(
          'Revisa el documento o actualiza los datos; puede estar aplicado.',
        );
      const r = documentReview.parse(d.reviewed);
      checkDocumentTotals(r);
      let orderId: string, note: string;
      if (r.kind === 'QUOTE') {
        if (!v.expectedDate) throw new BadRequestException('Indica la fecha esperada de entrega');
        const o = await tx.purchaseOrder.create({
          data: {
            projectId: d.projectId,
            supplier: r.supplier,
            expectedDate: new Date(v.expectedDate),
            lines: {
              create: r.lines.map((l) => ({
                materialId: l.materialId,
                quantity: l.quantity,
                unitPrice: l.unitPrice,
              })),
            },
          },
        });
        orderId = o.id;
        note = `OC-${o.number} creada en borrador. Importes netos sin impuestos.`;
      } else {
        if (!v.orderId) throw new BadRequestException('Selecciona una compra de esta obra');
        const o = await tx.purchaseOrder.findUnique({
          where: { id: v.orderId },
          include: includeOrder,
        });
        if (!o || o.projectId !== d.projectId || o.status === 'CANCELLED')
          throw new BadRequestException('La compra no pertenece a la obra o está cancelada');
        if (
          o.supplier.trim().toLowerCase().replace(/\s+/g, ' ') !==
          r.supplier.trim().toLowerCase().replace(/\s+/g, ' ')
        )
          throw new BadRequestException('El proveedor no coincide con la compra');
        orderId = o.id;
        if (r.kind === 'INVOICE') {
          note = `Factura vinculada a OC-${o.number}; no crea recepción ni pago.`;
        } else {
          if (!['APPROVED', 'PARTIAL'].includes(o.status))
            throw new ConflictException('Selecciona una compra aprobada con cantidades pendientes');
          if (!v.lineIds || v.lineIds.length !== r.lines.length)
            throw new BadRequestException('Relaciona cada partida con la compra');
          const quantities = new Map<string, Prisma.Decimal>();
          for (let i = 0; i < r.lines.length; i++) {
            const l = r.lines[i],
              ol = o.lines.find((x) => x.id === v.lineIds![i]);
            if (!ol || ol.materialId !== l.materialId)
              throw new BadRequestException('Una partida no coincide con el material de la compra');
            if (!ol.unitPrice.eq(l.unitPrice))
              throw new ConflictException(
                'El precio de la remisión no coincide con la compra. Revisa el documento antes de recibir.',
              );
            quantities.set(ol.id, (quantities.get(ol.id) || D(0)).add(l.quantity));
          }
          for (const [lineId, quantity] of quantities) {
            const l = o.lines.find((x) => x.id === lineId)!;
            if (l.received.add(quantity).gt(l.quantity))
              throw new ConflictException('La remisión excede la cantidad pendiente de la compra');
            const stock = await tx.stock.findUnique({
              where: { projectId_materialId: { projectId: d.projectId, materialId: l.materialId } },
            });
            const avg = averageCost(
              stock?.quantity || 0,
              stock?.averageCost || 0,
              quantity,
              l.unitPrice,
            );
            await tx.stock.upsert({
              where: { projectId_materialId: { projectId: d.projectId, materialId: l.materialId } },
              create: {
                projectId: d.projectId,
                materialId: l.materialId,
                quantity,
                averageCost: avg,
              },
              update: { quantity: { increment: quantity }, averageCost: avg },
            });
            await tx.orderLine.update({
              where: { id: lineId },
              data: { received: { increment: quantity } },
            });
            await tx.movement.create({
              data: {
                projectId: d.projectId,
                materialId: l.materialId,
                type: 'IN',
                quantity,
                unitCost: l.unitPrice,
                reference: `OC-${o.number} · DOC-${d.number} · ${r.folio}`,
              },
            });
          }
          await tx.purchaseOrder.update({
            where: { id: o.id },
            data: {
              status: o.lines.every((l) => l.received.add(quantities.get(l.id) || 0).eq(l.quantity))
                ? 'RECEIVED'
                : 'PARTIAL',
            },
          });
          note = `Remisión recibida en OC-${o.number}; inventario actualizado.`;
        }
      }
      const result = await tx.sourceDocument.update({
        where: { id },
        data: {
          status: 'APPLIED',
          orderId,
          revision: { increment: 1 },
          events: { create: { action: 'APPLY', note, actor: req.actor.name } },
        },
        select: documentMeta,
      });
      await audit(tx, req, 'Documento aplicado', id, note);
      return result;
    });
  }

  @Post('drawings') async createDrawing(@Body() body: unknown, @Req() req: AuthRequest) {
    const v = planFileSchema
      .extend({ projectId: text, code: text.max(24), title: text })
      .parse(body);
    const file = await decodePlan(v.base64);
    return command(req, async (tx) => {
      await project(tx, v.projectId);
      if ((await tx.drawing.count({ where: { projectId: v.projectId } })) >= 100)
        throw new ConflictException('Máximo 100 planos por obra en el piloto');
      const drawing = await tx.drawing.create({
        data: {
          projectId: v.projectId,
          code: v.code.toUpperCase(),
          name: v.title,
          versions: {
            create: {
              ...file,
              number: 1,
              label: v.label,
              note: v.note,
              name: safeFilename(v.name),
              author: req.actor.name,
            },
          },
        },
        include: drawingInclude,
      });
      await audit(tx, req, 'Plano registrado', drawing.id, drawing.code + ' · versión 1');
      return drawing;
    });
  }
  @Post('drawings/:id/versions') async addDrawingVersion(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    const v = planFileSchema.parse(body);
    const file = await decodePlan(v.base64);
    return command(req, async (tx) => {
      const drawing = await tx.drawing.findUnique({ where: { id } });
      if (!drawing) throw new NotFoundException('Plano no encontrado');
      await project(tx, drawing.projectId);
      const versions = await tx.drawingVersion.aggregate({
        where: { drawingId: id },
        _max: { number: true },
        _sum: { size: true },
        _count: true,
      });
      if (versions._count >= 20 || (versions._sum.size || 0) + file.size > 100 * 1024 * 1024)
        throw new ConflictException('Máximo 20 versiones o 100 MB por plano');
      if (
        await tx.drawingVersion.findUnique({
          where: { drawingId_sha256: { drawingId: id, sha256: file.sha256 } },
        })
      )
        throw new ConflictException('Ese PDF ya pertenece a este plano');
      const version = await tx.drawingVersion.create({
        data: {
          ...file,
          drawingId: id,
          number: (versions._max.number || 0) + 1,
          label: v.label,
          note: v.note,
          name: safeFilename(v.name),
          author: req.actor.name,
        },
        select: versionMeta,
      });
      await audit(
        tx,
        req,
        'Versión de plano registrada',
        id,
        'v' + version.number + ' · ' + v.note,
      );
      return version;
    });
  }
  @Get('drawings/:id/versions/:versionId/file') async drawingFile(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @Res() res: Response,
  ) {
    const file = await db.drawingVersion.findFirst({ where: { id: versionId, drawingId: id } });
    if (!file) throw new NotFoundException('Versión no encontrada');
    res
      .set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      })
      .send(Buffer.from(file.content));
  }
  @Post('drawings/:id/versions/:versionId/issues') async createPlanIssue(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    const v = issueSchema.parse(body);
    return command(req, async (tx) => {
      const version = await tx.drawingVersion.findFirst({
        where: { id: versionId, drawingId: id },
        include: { drawing: true },
      });
      if (!version) throw new NotFoundException('Versión no encontrada');
      await project(tx, version.drawing.projectId);
      if (v.page > version.pageCount)
        throw new BadRequestException('La página no existe en esta versión');
      if ((await tx.planIssue.count({ where: { versionId } })) >= 200)
        throw new ConflictException('Máximo 200 incidencias por versión');
      const result = await tx.planIssue.create({
        data: {
          ...v,
          versionId,
          dueDate: new Date(v.dueDate),
          author: req.actor.name,
          events: {
            create: {
              action: 'CREATED',
              note: v.description,
              author: req.actor.name,
              assignee: v.assignee,
              dueDate: new Date(v.dueDate),
            },
          },
        },
        include: issueInclude,
      });
      await audit(
        tx,
        req,
        'Incidencia en plano registrada',
        result.id,
        `INC-${result.number} · v${version.number} · página ${v.page}`,
      );
      return result;
    });
  }
  @Post('plan-issues/:id/events') async updatePlanIssue(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    const v = issueEventSchema.parse(body);
    const files = decodeIssueEvidence(v);
    return command(req, async (tx) => {
      const issue = await tx.planIssue.findUnique({
        where: { id },
        include: { version: { include: { drawing: true } } },
      });
      if (!issue) throw new NotFoundException('Incidencia no encontrada');
      await project(tx, issue.version.drawing.projectId);
      if (issue.revision !== v.expectedRevision)
        throw new ConflictException('La incidencia cambió. Actualiza la vista antes de guardar.');
      if ((await tx.issueEvent.count({ where: { issueId: id } })) >= 100)
        throw new ConflictException('Máximo 100 actualizaciones por incidencia');
      const usage = await tx.issueEvidence.aggregate({
        where: { event: { issueId: id } },
        _sum: { size: true },
      });
      if ((usage._sum.size || 0) + files.reduce((n, f) => n + f.size, 0) > 40 * 1024 * 1024)
        throw new ConflictException('Máximo 40 MB de evidencia por incidencia');
      const status = eventStatus(issue.status, v.action),
        assignee = v.action === 'ASSIGN' ? v.assignee! : issue.assignee,
        dueDate = v.action === 'ASSIGN' ? new Date(v.dueDate!) : issue.dueDate;
      const result = await tx.planIssue.update({
        where: { id },
        data: {
          status,
          assignee,
          dueDate,
          revision: { increment: 1 },
          events: {
            create: {
              action: v.action,
              note: v.note,
              assignee,
              dueDate,
              author: req.actor.name,
              evidence: { create: files },
            },
          },
        },
        include: issueInclude,
      });
      await audit(
        tx,
        req,
        'Incidencia actualizada',
        id,
        `INC-${issue.number} · ${v.action} · ${v.note.slice(0, 150)}`,
      );
      return result;
    });
  }
  @Get('plan-issues/:id/evidence/:evidenceId') async issueEvidence(
    @Param('id') id: string,
    @Param('evidenceId') evidenceId: string,
    @Res() res: Response,
  ) {
    const file = await db.issueEvidence.findFirst({
      where: { id: evidenceId, event: { issueId: id } },
    });
    if (!file) throw new NotFoundException('Evidencia no encontrada');
    res
      .set({
        'Content-Type': file.mime,
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      })
      .send(Buffer.from(file.content));
  }
  private async exportLogsPdf(
    req: AuthRequest,
    res: Response,
    where: Prisma.SiteLogWhereInput,
    options: { company?: string; includePhotos: boolean },
  ) {
    if (exportingLogs.has(req.actor.id))
      throw new HttpException('Ya estás generando un expediente. Espera a que termine.', 429);
    exportingLogs.add(req.actor.id);
    try {
      const logs = await db.$transaction(
        async (tx) => {
          const scope =
            req.actor.role === 'ADMIN' ? {} : { projectId: { in: req.actor.projectIds } };
          const records = await tx.siteLog.findMany({
            where: { AND: [where, scope] },
            take: 31,
            orderBy: [{ date: 'asc' }, { id: 'asc' }],
            include: {
              project: true,
              budgetItem: { select: { code: true, name: true } },
              attachments: {
                select: attachmentMeta,
                orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
              },
              addenda: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
            },
          });
          if (!records.length)
            throw new BadRequestException('No hay bitácoras en el periodo y estado seleccionados.');
          if (records.length > 30)
            throw new BadRequestException(
              'El periodo contiene más de 30 bitácoras. Divide el expediente en periodos más cortos.',
            );
          if (new Set(records.map((r) => r.projectId)).size !== 1)
            throw new BadRequestException('Genera un expediente por obra.');
          const photos = options.includePhotos
            ? records.flatMap((r) => r.attachments).filter((a) => a.mime.startsWith('image/'))
            : [];
          if (photos.reduce((n, p) => n + p.size, 0) > 100 * 1024 * 1024)
            throw new BadRequestException(
              'Las fotos superan 100 MB. Selecciona un periodo más corto.',
            );
          const files = photos.length
            ? await tx.logAttachment.findMany({
                where: { id: { in: photos.map((p) => p.id) } },
                select: { id: true, content: true },
              })
            : [];
          const byId = new Map(files.map((f) => [f.id, f.content]));
          return records.map((r) => ({
            ...r,
            attachments: r.attachments.map((a) => ({ ...a, content: byId.get(a.id) })),
          }));
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 15000 },
      );
      const bytes = await createLogReport(logs[0].project, logs, {
        ...options,
        author: req.actor.name,
      });
      const code = logs[0].project.code.replace(/[^a-zA-Z0-9_-]/g, '_');
      const name = `Bitacoras_${code}_${logs[0].date.toISOString().slice(0, 10)}_${logs.at(-1)!.date.toISOString().slice(0, 10)}.pdf`;
      res
        .set({
          'Content-Type': 'application/pdf',
          'Content-Length': String(bytes.length),
          'Content-Disposition': `attachment; filename="${name}"`,
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        })
        .send(bytes);
    } finally {
      exportingLogs.delete(req.actor.id);
    }
  }
  @Get('logs/:id/pdf') async logPdf(
    @Param('id') id: string,
    @Req() req: AuthRequest,
    @Res() res: Response,
  ) {
    return this.exportLogsPdf(req, res, { id }, { includePhotos: true });
  }
  @Post('logs/export') async logDossier(
    @Body() body: unknown,
    @Req() req: AuthRequest,
    @Res() res: Response,
  ) {
    const v = logExportSchema.parse(body);
    return this.exportLogsPdf(
      req,
      res,
      {
        projectId: v.projectId,
        date: { gte: new Date(v.from), lte: new Date(v.to) },
        ...(v.includeDrafts ? {} : { status: 'CLOSED' }),
      },
      { company: v.company, includePhotos: v.includePhotos },
    );
  }
  @Post('logs') async createLog(@Body() b: unknown, @Req() req: AuthRequest) {
    const v = logSchema.parse(b);
    return command(req, async (tx) => {
      await project(tx, v.projectId);
      if (v.budgetItemId) {
        const item = await tx.budgetItem.findUnique({ where: { id: v.budgetItemId } });
        if (!item || item.projectId !== v.projectId)
          throw new BadRequestException('El concepto no pertenece a esta obra');
      }
      const l = await tx.siteLog.create({
        data: { ...v, date: new Date(v.date), author: req.actor.name },
      });
      await audit(tx, req, 'Bitácora registrada', l.id, v.title);
      return l;
    });
  }
  @Post('logs/:id/attachments') async attachLog(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    const v = z
      .object({
        name: text,
        mime: text.max(100),
        base64: z.string().max(11184812),
        caption: text,
        addendumId: text.optional(),
      })
      .parse(body);
    const file = decodeEvidence(v.base64, v.mime);
    return command(req, async (tx) => {
      const log = await tx.siteLog.findUnique({ where: { id } });
      if (!log) throw new NotFoundException('Bitácora no encontrada');
      await project(tx, log.projectId);
      if (v.addendumId) {
        const note = await tx.logAddendum.findUnique({ where: { id: v.addendumId } });
        if (!note || note.logId !== id)
          throw new BadRequestException('La adenda no pertenece a esta bitácora');
      }
      if (log.status === 'CLOSED' && !v.addendumId)
        throw new ConflictException(
          'La bitácora está cerrada. Crea una adenda para agregar evidencia.',
        );
      const current = await tx.logAttachment.aggregate({
        where: { logId: id },
        _count: true,
        _sum: { size: true },
      });
      if (current._count >= 20 || (current._sum.size || 0) + file.size > 40 * 1024 * 1024)
        throw new ConflictException('Límite de evidencia: 20 archivos o 40 MB por bitácora.');
      if (
        await tx.logAttachment.findUnique({
          where: { logId_sha256: { logId: id, sha256: file.sha256 } },
        })
      )
        throw new ConflictException('Este archivo ya está adjunto a la bitácora.');
      const name = v.name.replace(/[\\/\x00-\x1f\x7f]/g, '_');
      const result = await tx.logAttachment.create({
        data: {
          ...file,
          logId: id,
          addendumId: v.addendumId,
          name,
          caption: v.caption,
          author: req.actor.name,
        },
        select: attachmentMeta,
      });
      await audit(tx, req, 'Evidencia adjunta', id, `${result.id} · ${name} · ${file.sha256}`);
      return result;
    });
  }
  @Get('logs/:id/attachments/:attachmentId') async readAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Req() req: AuthRequest,
    @Res() res: Response,
  ) {
    const file = await db.logAttachment.findFirst({ where: { id: attachmentId, logId: id } });
    if (!file) throw new NotFoundException('Evidencia no encontrada');
    const bytes = Buffer.from(file.content);
    res.set({
      'Content-Type': file.mime,
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Accept-Ranges': 'bytes',
    });
    const range = req.headers.range;
    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      const start = match ? Number(match[1]) : -1;
      const end =
        match && match[2] ? Math.min(Number(match[2]), bytes.length - 1) : bytes.length - 1;
      if (!match || start < 0 || start >= bytes.length || end < start) {
        res.status(416).set('Content-Range', `bytes */${bytes.length}`).end();
        return;
      }
      res
        .status(206)
        .set({
          'Content-Range': `bytes ${start}-${end}/${bytes.length}`,
          'Content-Length': String(end - start + 1),
        })
        .send(bytes.subarray(start, end + 1));
      return;
    }
    res.set('Content-Length', String(bytes.length)).send(bytes);
  }
  @Post('logs/:id/addenda') async addendum(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    const v = z
      .object({ text: z.string().trim().min(1).max(10000), sourceAttachmentId: text.optional() })
      .parse(body);
    return command(req, async (tx) => {
      const log = await tx.siteLog.findUnique({ where: { id } });
      if (!log) throw new NotFoundException('Bitácora no encontrada');
      await project(tx, log.projectId);
      if ((await tx.logAddendum.count({ where: { logId: id } })) >= 50)
        throw new ConflictException('Máximo 50 adendas por bitácora.');
      if (v.sourceAttachmentId) {
        const source = await tx.logAttachment.findUnique({ where: { id: v.sourceAttachmentId } });
        if (!source || source.logId !== id || source.transcriptionStatus !== 'READY')
          throw new BadRequestException(
            'La transcripción no pertenece a esta bitácora o aún no está lista',
          );
      }
      const note = await tx.logAddendum.create({
        data: { ...v, logId: id, author: req.actor.name },
      });
      await audit(tx, req, 'Adenda registrada', id, note.id);
      return note;
    });
  }
  @Post('logs/:id/attachments/:attachmentId/transcribe') async transcribe(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    z.object({ sendToOpenAI: z.literal(true) }).parse(body);
    const key = process.env.OPENAI_API_KEY;
    if (!key)
      throw new HttpException(
        'La transcripción no está configurada. Puedes guardar y escuchar audio.',
        503,
      );
    const file = await db.logAttachment.findFirst({
      where: { id: attachmentId, logId: id },
      include: { log: true },
    });
    if (!file) throw new NotFoundException('Evidencia no encontrada');
    if (!file.mime.startsWith('audio/')) throw new BadRequestException('Solo se transcribe audio');
    if (file.transcriptionStatus === 'READY') return { text: file.transcript };
    const p = await db.project.findUnique({ where: { id: file.log.projectId } });
    if (p?.status !== 'ACTIVE') throw new ConflictException('La obra está cerrada');
    const attempt = transcriptionAttempts.get(req.actor.id);
    if (attempt && attempt.until > Date.now() && attempt.count >= 10)
      throw new HttpException('Límite de 10 transcripciones por hora. Intenta más tarde.', 429);
    const startedAt = new Date();
    const claim = await db.logAttachment.updateMany({
      where: {
        id: attachmentId,
        OR: [
          { transcriptionStatus: { in: ['NONE', 'ERROR'] } },
          {
            transcriptionStatus: 'PROCESSING',
            transcriptionStartedAt: { lt: new Date(Date.now() - 5 * 60000) },
          },
        ],
      },
      data: { transcriptionStatus: 'PROCESSING', transcriptionStartedAt: startedAt },
    });
    if (!claim.count)
      throw new ConflictException('El audio ya está en proceso. Espera antes de reintentar.');
    transcriptionAttempts.set(req.actor.id, {
      count: attempt && attempt.until > Date.now() ? attempt.count + 1 : 1,
      until: attempt && attempt.until > Date.now() ? attempt.until : Date.now() + 3600000,
    });
    try {
      const transcript = await transcribeAudio(file, key);
      await db.$transaction(async (tx) => {
        await tx.logAttachment.update({
          where: { id: attachmentId },
          data: { transcript, transcriptionStatus: 'READY' },
        });
        await audit(
          tx,
          req,
          'Transcripción preparada',
          id,
          `${attachmentId} · pendiente de revisión`,
        );
      });
      return { text: transcript };
    } catch (e) {
      await db.logAttachment.update({
        where: { id: attachmentId },
        data: { transcriptionStatus: 'ERROR' },
      });
      throw e;
    }
  }
  @Post('logs/:id/close') async closeLog(@Param('id') id: string, @Req() req: AuthRequest) {
    return command(req, async (tx) => {
      const l = await tx.siteLog.findUnique({ where: { id } });
      if (!l) throw new NotFoundException();
      await project(tx, l.projectId);
      if (l.status !== 'DRAFT') throw new ConflictException('La bitácora ya está cerrada');
      const updated = await tx.siteLog.update({ where: { id }, data: { status: 'CLOSED' } });
      await audit(tx, req, 'Bitácora cerrada', id, l.title);
      return updated;
    });
  }
}
@Module({ controllers: [Api] })
class AppModule {}
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
