import {
  Body,
  ConflictException,
  Controller,
  NotFoundException,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { z } from 'zod';
import { averageCost } from '../domain';
import { AuthRequest, audit, command, project } from '../shared/commands';
import { positive, text } from '../shared/schemas';

@Controller('api')
export class StockController {
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
}
