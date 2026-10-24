import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpException,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { type Response } from 'express';
import { z } from 'zod';
import { attachmentMeta, decodeEvidence, transcribeAudio } from '../log-evidence';
import { createLogReport, logExportSchema } from '../log-report';
import { AuthRequest, audit, command, project } from '../shared/commands';
import { db } from '../shared/database';
import { logSchema, text } from '../shared/schemas';
const transcriptionAttempts = new Map<string, { count: number; until: number }>();
const exportingLogs = new Set<string>();
@Controller('api')
export class LogsController {
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
