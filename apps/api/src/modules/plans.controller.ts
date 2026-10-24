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
  Res,
} from '@nestjs/common';
import { type Response } from 'express';
import {
  decodeIssueEvidence,
  decodePlan,
  drawingInclude,
  eventStatus,
  issueEventSchema,
  issueInclude,
  issueSchema,
  planFileSchema,
  safeFilename,
  versionMeta,
} from '../plans';
import { AuthRequest, audit, command, project } from '../shared/commands';
import { db } from '../shared/database';
import { text } from '../shared/schemas';

@Controller('api')
export class PlansController {
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
}
