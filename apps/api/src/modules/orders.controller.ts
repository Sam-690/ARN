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
import { z } from 'zod';
import { D, averageCost, moneySummary } from '../domain';
import { AuthRequest, audit, command, project } from '../shared/commands';
import { date, includeOrder, orderSchema, positive, text } from '../shared/schemas';

@Controller('api')
export class OrdersController {
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
}
