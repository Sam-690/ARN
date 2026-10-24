import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { D } from '../domain';
import { AuthRequest, audit, command, project } from '../shared/commands';
import { budgetSchema } from '../shared/schemas';

@Controller('api')
export class BudgetController {
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
}
