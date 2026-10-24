import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { type Response } from 'express';
import { ZodError } from 'zod';

@Catch()
export class Errors implements ExceptionFilter {
  catch(e: any, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (e instanceof ZodError)
      return res
        .status(400)
        .json({ message: e.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join(' · ') });
    if (e instanceof HttpException) return res.status(e.getStatus()).json({ message: e.message });
    if (e.code === 'P2002')
      return res.status(409).json({ message: 'Ya existe un registro con esa clave o referencia.' });
    if (e.code === 'P2003')
      return res.status(400).json({ message: 'El registro relacionado no existe.' });
    if (e.code === 'P2025') return res.status(404).json({ message: 'Registro no encontrado.' });
    console.error(e);
    return res
      .status(500)
      .json({ message: 'No se pudo completar la operación. Intenta de nuevo.' });
  }
}
