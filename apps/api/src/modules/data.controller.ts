import { Controller, Get, Req } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { roleLabels, rolePermissions } from '../access';
import { changeBalance, changeInclude, projectChangeSummary } from '../changes';
import { documentMeta } from '../documents';
import { D, moneySummary } from '../domain';
import { experienceGroups, experienceInclude, experienceMetrics } from '../experience';
import { attachmentMeta } from '../log-evidence';
import { drawingInclude, issueInclude } from '../plans';
import { AuthRequest } from '../shared/commands';
import { db } from '../shared/database';
import { includeOrder } from '../shared/schemas';
import { supplyCoverage } from '../supply';

@Controller('api')
export class DataController {
  @Get('health') health() {
    return { status: 'ok', version: '0.1.0' };
  }
  @Get('data') async data(@Req() req: AuthRequest) {
    const scope = req.actor.role === 'ADMIN' ? {} : { projectId: { in: req.actor.projectIds } },
      projectScope = req.actor.role === 'ADMIN' ? {} : { id: { in: req.actor.projectIds } };
    const transferScope =
      req.actor.role === 'ADMIN'
        ? {}
        : {
            fromProjectId: { in: req.actor.projectIds },
            toProjectId: { in: req.actor.projectIds },
          };
    const [
      projects,
      materials,
      orders,
      stocks,
      movements,
      logs,
      audits,
      needs,
      transfers,
      drawings,
      planIssues,
      changes,
      documents,
      experienceFamilies,
      experienceRecords,
      consumptionMovements,
    ] = await db.$transaction(
      [
        db.project.findMany({
          where: projectScope,
          include: { budgetItems: true },
          orderBy: { createdAt: 'desc' },
        }),
        db.material.findMany({ orderBy: { name: 'asc' } }),
        db.purchaseOrder.findMany({
          where: scope,
          include: includeOrder,
          orderBy: { createdAt: 'desc' },
        }),
        db.stock.findMany({ where: scope, include: { material: true, project: true } }),
        db.movement.findMany({
          where: scope,
          include: { material: true, project: true },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
        db.siteLog.findMany({
          where: scope,
          include: {
            project: true,
            budgetItem: true,
            attachments: { select: attachmentMeta, orderBy: { createdAt: 'asc' } },
            addenda: { orderBy: { createdAt: 'asc' } },
          },
          orderBy: { date: 'desc' },
        }),
        db.audit.findMany({
          where: req.actor.role === 'ADMIN' ? {} : { id: '__hidden__' },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
        db.supplyNeed.findMany({
          where: scope,
          include: { project: true, material: true },
          orderBy: [{ neededOn: 'asc' }, { createdAt: 'asc' }],
        }),
        db.stockTransfer.findMany({
          where: transferScope,
          include: { fromProject: true, toProject: true, material: true },
          orderBy: { createdAt: 'desc' },
        }),
        db.drawing.findMany({
          where: scope,
          include: drawingInclude,
          orderBy: { createdAt: 'desc' },
        }),
        db.planIssue.findMany({
          where: { version: { drawing: scope } },
          include: issueInclude,
          orderBy: { number: 'desc' },
        }),
        db.changeRequest.findMany({
          where: scope,
          include: changeInclude,
          orderBy: { number: 'desc' },
        }),
        db.sourceDocument.findMany({
          where: scope,
          select: documentMeta,
          orderBy: { number: 'desc' },
        }),
        db.experienceFamily.findMany({ orderBy: { createdAt: 'desc' } }),
        db.experienceRecord.findMany({
          where: scope,
          include: experienceInclude,
          orderBy: { number: 'desc' },
        }),
        db.movement.findMany({
          where: { ...scope, type: 'OUT' },
          include: {
            material: true,
            allocations: { include: { record: { select: { status: true } } } },
          },
          orderBy: { createdAt: 'desc' },
        }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return {
      experience: {
        families: experienceFamilies,
        records: experienceRecords.map((r) => ({ ...r, metrics: experienceMetrics(r) })),
        groups: experienceGroups(experienceRecords),
        byProject: Object.fromEntries(
          projects.map((p) => [
            p.id,
            experienceGroups(experienceRecords.filter((r) => r.projectId === p.id)),
          ]),
        ),
        movements: consumptionMovements.map(({ allocations, ...m }) => ({
          ...m,
          available: m.quantity
            .sub(
              allocations
                .filter((a) => a.record.status !== 'VOID')
                .reduce((s, a) => s.add(a.quantity), D(0)),
            )
            .toFixed(4),
        })),
      },
      documents,
      capabilities: {
        documentExtraction: Boolean(
          process.env.OPENAI_API_KEY && process.env.DOCUMENT_EXTRACTION_MODEL,
        ),
        transcription: Boolean(process.env.OPENAI_API_KEY),
      },
      user: {
        ...req.actor,
        roleLabel: roleLabels[req.actor.role as keyof typeof roleLabels],
        permissions: rolePermissions[req.actor.role] || [],
      },
      projects: projects.map((p) => ({ ...p, changeSummary: projectChangeSummary(p, changes) })),
      materials,
      orders: orders.map((o) => ({ ...o, ...moneySummary(o) })),
      stocks,
      movements,
      logs,
      audits,
      needs,
      transfers,
      drawings,
      planIssues,
      changes: changes.map((c) => ({ ...c, ...changeBalance(c) })),
      coverage: supplyCoverage(
        needs,
        stocks,
        orders,
        new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' }),
      ),
    };
  }
}
