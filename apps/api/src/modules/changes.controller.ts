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
import {
  changeActionSchema,
  changeBalance,
  changeInclude,
  changeSchema,
  changeStatus,
  latestProposal,
  projectChangeSummary,
} from '../changes';
import { D } from '../domain';
import { AuthRequest, audit, command, project } from '../shared/commands';

@Controller('api')
export class ChangesController {
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
}
