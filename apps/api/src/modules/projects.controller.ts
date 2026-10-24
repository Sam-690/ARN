import { Body, ConflictException, Controller, Param, Post, Req } from '@nestjs/common';
import { changeBalance, changeInclude } from '../changes';
import { D, moneySummary } from '../domain';
import { AuthRequest, audit, command, project } from '../shared/commands';
import { includeOrder, projectSchema } from '../shared/schemas';

@Controller('api')
export class ProjectsController {
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
}
