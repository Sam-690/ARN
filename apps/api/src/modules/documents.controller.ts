import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpException,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { type Response } from 'express';
import { z } from 'zod';
import {
  checkDocumentTotals,
  decodeDocument,
  documentIdentity,
  documentMeta,
  documentReview,
  documentUpload,
  extractDocument,
} from '../documents';
import { D, averageCost } from '../domain';
import { AuthRequest, audit, command, project } from '../shared/commands';
import { db } from '../shared/database';
import { date, includeOrder, text } from '../shared/schemas';
const documentAttempts = new Map<string, { count: number; until: number }>();
@Controller('api')
export class DocumentsController {
  @Post('documents') async uploadDocument(@Body() body: unknown, @Req() req: AuthRequest) {
    const v = documentUpload.parse(body),
      file = await decodeDocument(v);
    return command(req, async (tx) => {
      await project(tx, v.projectId);
      const duplicate = await tx.sourceDocument.findUnique({ where: { sha256: file.sha256 } });
      if (duplicate)
        throw new ConflictException(
          `Este archivo ya existe como DOC-${duplicate.number}. Consulta el registro original.`,
        );
      if ((await tx.sourceDocument.count({ where: { projectId: v.projectId } })) >= 200)
        throw new ConflictException('Máximo 200 documentos por obra en este piloto');
      const d = await tx.sourceDocument.create({
        data: {
          projectId: v.projectId,
          ...file,
          author: req.actor.name,
          events: {
            create: {
              action: 'UPLOAD',
              note: 'Original conservado; pendiente de revisión',
              actor: req.actor.name,
            },
          },
        },
        select: documentMeta,
      });
      await audit(tx, req, 'Documento guardado', d.id, d.name);
      return d;
    });
  }
  @Get('documents/:id/file') async documentFile(@Param('id') id: string, @Res() res: Response) {
    const d = await db.sourceDocument.findUnique({ where: { id } });
    if (!d) throw new NotFoundException();
    res.set({
      'Content-Type': d.mime,
      'Content-Length': String(d.size),
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(d.name)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(Buffer.from(d.content));
  }
  @Post('documents/:id/extract') async readDocument(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    const v = z
        .object({ consent: z.literal(true), expectedRevision: z.number().int().min(0) })
        .parse(body),
      key = process.env.OPENAI_API_KEY,
      model = process.env.DOCUMENT_EXTRACTION_MODEL;
    if (!key || !model)
      throw new HttpException(
        'La lectura automática no está configurada. Puedes capturar los datos manualmente.',
        503,
      );
    const attempt = documentAttempts.get(req.actor.id);
    if (attempt && attempt.until > Date.now() && attempt.count >= 10)
      throw new HttpException('Límite de 10 lecturas por hora. Intenta más tarde.', 429);
    const startedAt = new Date();
    const file = await db.$transaction(
      async (tx) => {
        const d = await tx.sourceDocument.findUnique({ where: { id } });
        if (!d) throw new NotFoundException();
        await project(tx, d.projectId);
        if (d.status !== 'DRAFT' || d.revision !== v.expectedRevision)
          throw new ConflictException('El documento cambió. Actualiza los datos.');
        if (
          d.extractionStatus === 'PROCESSING' &&
          d.extractionStartedAt &&
          Date.now() - d.extractionStartedAt.getTime() < 120000
        )
          throw new ConflictException('La lectura está en curso. Actualiza en unos momentos.');
        await tx.sourceDocument.update({
          where: { id },
          data: {
            extractionStatus: 'PROCESSING',
            extractionStartedAt: startedAt,
            revision: { increment: 1 },
          },
        });
        return d;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    documentAttempts.set(req.actor.id, {
      count: attempt && attempt.until > Date.now() ? attempt.count + 1 : 1,
      until: attempt && attempt.until > Date.now() ? attempt.until : Date.now() + 3600000,
    });
    try {
      const extracted = await extractDocument(file, key, model);
      return await db.$transaction(async (tx) => {
        await project(tx, file.projectId);
        const updated = await tx.sourceDocument.updateMany({
          where: {
            id,
            revision: v.expectedRevision + 1,
            status: 'DRAFT',
            extractionStartedAt: startedAt,
          },
          data: {
            extracted,
            reviewed: Prisma.DbNull,
            extractionStatus: 'READY',
            revision: { increment: 1 },
          },
        });
        if (!updated.count)
          throw new ConflictException(
            'El documento cambió durante la lectura. Se conservó tu revisión.',
          );
        await tx.documentEvent.create({
          data: {
            documentId: id,
            action: 'EXTRACT',
            note: `Lectura con ${model}; todos los campos requieren revisión`,
            actor: req.actor.name,
            snapshot: extracted,
          },
        });
        return { ok: true };
      });
    } catch (e) {
      await db.sourceDocument.updateMany({
        where: { id, revision: v.expectedRevision + 1, extractionStartedAt: startedAt },
        data: { extractionStatus: 'ERROR', revision: { increment: 1 } },
      });
      throw e;
    }
  }
  @Post('documents/:id/review') async reviewDocument(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    const v = z
      .object({
        expectedRevision: z.number().int().min(0),
        confirmed: z.literal(true),
        review: documentReview,
      })
      .parse(body);
    checkDocumentTotals(v.review);
    return command(req, async (tx) => {
      const d = await tx.sourceDocument.findUnique({ where: { id } });
      if (!d) throw new NotFoundException();
      await project(tx, d.projectId);
      if (d.status !== 'DRAFT' || d.revision !== v.expectedRevision)
        throw new ConflictException('El documento cambió o ya fue revisado. Actualiza los datos.');
      for (const l of v.review.lines) {
        const m = await tx.material.findUnique({ where: { id: l.materialId } });
        if (
          !m ||
          m.type !== 'MATERIAL' ||
          m.unit.trim().toLowerCase() !== l.unit.trim().toLowerCase()
        )
          throw new BadRequestException(
            'Cada partida debe corresponder a un material y su unidad de catálogo. Ajusta cantidades y precios si hay conversión.',
          );
      }
      const identityKey = documentIdentity(v.review);
      const duplicate = await tx.sourceDocument.findUnique({ where: { identityKey } });
      if (duplicate && duplicate.id !== id)
        throw new ConflictException(
          `Proveedor, tipo y folio ya registrados en DOC-${duplicate.number}`,
        );
      const updated = await tx.sourceDocument.update({
        where: { id },
        data: {
          reviewed: v.review,
          identityKey,
          status: 'REVIEWED',
          revision: { increment: 1 },
          events: {
            create: {
              action: 'REVIEW',
              actor: req.actor.name,
              note: v.review.note,
              snapshot: v.review,
            },
          },
        },
        select: documentMeta,
      });
      await audit(tx, req, 'Documento revisado', id, `${v.review.supplier} · ${v.review.folio}`);
      return updated;
    });
  }
  @Post('documents/:id/reopen') async reopenDocument(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    const v = z.object({ expectedRevision: z.number().int(), note: text }).parse(body);
    return command(req, async (tx) => {
      const d = await tx.sourceDocument.findUnique({ where: { id } });
      if (!d) throw new NotFoundException();
      await project(tx, d.projectId);
      if (d.status !== 'REVIEWED' || d.revision !== v.expectedRevision)
        throw new ConflictException('Solo se puede corregir un documento revisado sin aplicar');
      return tx.sourceDocument.update({
        where: { id },
        data: {
          status: 'DRAFT',
          revision: { increment: 1 },
          events: { create: { action: 'REOPEN', note: v.note, actor: req.actor.name } },
        },
        select: documentMeta,
      });
    });
  }
  @Post('documents/:id/apply') async applyDocument(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    const v = z
      .object({
        expectedRevision: z.number().int().min(0),
        confirmed: z.literal(true),
        expectedDate: date.optional(),
        orderId: text.optional(),
        lineIds: z.array(text).max(100).optional(),
      })
      .parse(body);
    return command(req, async (tx) => {
      const d = await tx.sourceDocument.findUnique({ where: { id } });
      if (!d) throw new NotFoundException();
      await project(tx, d.projectId);
      if (d.status !== 'REVIEWED' || d.revision !== v.expectedRevision)
        throw new ConflictException(
          'Revisa el documento o actualiza los datos; puede estar aplicado.',
        );
      const r = documentReview.parse(d.reviewed);
      checkDocumentTotals(r);
      let orderId: string, note: string;
      if (r.kind === 'QUOTE') {
        if (!v.expectedDate) throw new BadRequestException('Indica la fecha esperada de entrega');
        const o = await tx.purchaseOrder.create({
          data: {
            projectId: d.projectId,
            supplier: r.supplier,
            expectedDate: new Date(v.expectedDate),
            lines: {
              create: r.lines.map((l) => ({
                materialId: l.materialId,
                quantity: l.quantity,
                unitPrice: l.unitPrice,
              })),
            },
          },
        });
        orderId = o.id;
        note = `OC-${o.number} creada en borrador. Importes netos sin impuestos.`;
      } else {
        if (!v.orderId) throw new BadRequestException('Selecciona una compra de esta obra');
        const o = await tx.purchaseOrder.findUnique({
          where: { id: v.orderId },
          include: includeOrder,
        });
        if (!o || o.projectId !== d.projectId || o.status === 'CANCELLED')
          throw new BadRequestException('La compra no pertenece a la obra o está cancelada');
        if (
          o.supplier.trim().toLowerCase().replace(/\s+/g, ' ') !==
          r.supplier.trim().toLowerCase().replace(/\s+/g, ' ')
        )
          throw new BadRequestException('El proveedor no coincide con la compra');
        orderId = o.id;
        if (r.kind === 'INVOICE') {
          note = `Factura vinculada a OC-${o.number}; no crea recepción ni pago.`;
        } else {
          if (!['APPROVED', 'PARTIAL'].includes(o.status))
            throw new ConflictException('Selecciona una compra aprobada con cantidades pendientes');
          if (!v.lineIds || v.lineIds.length !== r.lines.length)
            throw new BadRequestException('Relaciona cada partida con la compra');
          const quantities = new Map<string, Prisma.Decimal>();
          for (let i = 0; i < r.lines.length; i++) {
            const l = r.lines[i],
              ol = o.lines.find((x) => x.id === v.lineIds![i]);
            if (!ol || ol.materialId !== l.materialId)
              throw new BadRequestException('Una partida no coincide con el material de la compra');
            if (!ol.unitPrice.eq(l.unitPrice))
              throw new ConflictException(
                'El precio de la remisión no coincide con la compra. Revisa el documento antes de recibir.',
              );
            quantities.set(ol.id, (quantities.get(ol.id) || D(0)).add(l.quantity));
          }
          for (const [lineId, quantity] of quantities) {
            const l = o.lines.find((x) => x.id === lineId)!;
            if (l.received.add(quantity).gt(l.quantity))
              throw new ConflictException('La remisión excede la cantidad pendiente de la compra');
            const stock = await tx.stock.findUnique({
              where: { projectId_materialId: { projectId: d.projectId, materialId: l.materialId } },
            });
            const avg = averageCost(
              stock?.quantity || 0,
              stock?.averageCost || 0,
              quantity,
              l.unitPrice,
            );
            await tx.stock.upsert({
              where: { projectId_materialId: { projectId: d.projectId, materialId: l.materialId } },
              create: {
                projectId: d.projectId,
                materialId: l.materialId,
                quantity,
                averageCost: avg,
              },
              update: { quantity: { increment: quantity }, averageCost: avg },
            });
            await tx.orderLine.update({
              where: { id: lineId },
              data: { received: { increment: quantity } },
            });
            await tx.movement.create({
              data: {
                projectId: d.projectId,
                materialId: l.materialId,
                type: 'IN',
                quantity,
                unitCost: l.unitPrice,
                reference: `OC-${o.number} · DOC-${d.number} · ${r.folio}`,
              },
            });
          }
          await tx.purchaseOrder.update({
            where: { id: o.id },
            data: {
              status: o.lines.every((l) => l.received.add(quantities.get(l.id) || 0).eq(l.quantity))
                ? 'RECEIVED'
                : 'PARTIAL',
            },
          });
          note = `Remisión recibida en OC-${o.number}; inventario actualizado.`;
        }
      }
      const result = await tx.sourceDocument.update({
        where: { id },
        data: {
          status: 'APPLIED',
          orderId,
          revision: { increment: 1 },
          events: { create: { action: 'APPLY', note, actor: req.actor.name } },
        },
        select: documentMeta,
      });
      await audit(tx, req, 'Documento aplicado', id, note);
      return result;
    });
  }
}
