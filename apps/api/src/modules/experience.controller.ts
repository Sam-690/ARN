import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  NotFoundException,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { D } from '../domain';
import {
  experienceInclude,
  experienceMetrics,
  experienceSchema,
  familySchema,
  normalizeExperience,
} from '../experience';
import { AuthRequest, audit, command, project } from '../shared/commands';

@Controller('api')
export class ExperienceController {
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
}
