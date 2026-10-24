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
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { dateKey, forecast, forecastSchema } from '../forecast';
import { AuthRequest, audit, command, project } from '../shared/commands';
import { db } from '../shared/database';
import { date, positive, text } from '../shared/schemas';

@Controller('api')
export class SupplyController {
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
}
