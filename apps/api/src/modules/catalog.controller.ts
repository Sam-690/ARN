import { Body, Controller, Post, Req } from '@nestjs/common';
import { AuthRequest, audit, command } from '../shared/commands';
import { materialSchema } from '../shared/schemas';

@Controller('api')
export class CatalogController {
  @Post('materials') async createMaterial(@Body() b: unknown, @Req() req: AuthRequest) {
    const v = materialSchema.parse(b);
    return command(req, async (tx) => {
      const m = await tx.material.create({ data: { ...v, code: v.code.toUpperCase() } });
      await audit(tx, req, 'Insumo creado', m.id, m.name);
      return m;
    });
  }
}
