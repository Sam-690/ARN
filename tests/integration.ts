import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../apps/api/src/security';
const db = new PrismaClient();
const base = 'http://127.0.0.1:4101/api';
let api: ChildProcess,
  cookie = '';
let projectId = '',
  materialId = '',
  orderId = '',
  lineId = '',
  logId = '';
let output = '';
async function req(path: string, body?: any, key = randomUUID(), auth = true) {
  const r = await fetch(base + '/' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': key,
      ...(auth ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const value = await r.json();
  return { status: r.status, value };
}
before(async () => {
  assert.ok(
    process.env.DATABASE_URL?.includes('/obra_control_test?'),
    'Pruebas solo en la base aislada obra_control_test',
  );
  await db.$transaction([
    db.experienceEvent.deleteMany(),
    db.experienceAllocation.deleteMany(),
    db.experienceRecord.deleteMany(),
    db.experienceFamily.deleteMany(),
    db.documentEvent.deleteMany(),
    db.sourceDocument.deleteMany(),
    db.changeSettlement.deleteMany(),
    db.changeEvent.deleteMany(),
    db.changeProposal.deleteMany(),
    db.changeRequest.deleteMany(),
    db.issueEvidence.deleteMany(),
    db.issueEvent.deleteMany(),
    db.planIssue.deleteMany(),
    db.drawingVersion.deleteMany(),
    db.drawing.deleteMany(),
    db.command.deleteMany(),
    db.audit.deleteMany(),
    db.payment.deleteMany(),
    db.orderLine.deleteMany(),
    db.purchaseOrder.deleteMany(),
    db.movement.deleteMany(),
    db.stockTransfer.deleteMany(),
    db.supplyNeed.deleteMany(),
    db.stock.deleteMany(),
    db.logAttachment.updateMany({ data: { addendumId: null } }),
    db.logAddendum.deleteMany(),
    db.logAttachment.deleteMany(),
    db.siteLog.deleteMany(),
    db.budgetItem.deleteMany(),
    db.material.deleteMany(),
    db.project.deleteMany(),
    db.session.deleteMany(),
    db.projectMember.deleteMany(),
    db.user.deleteMany(),
  ]);
  await db.user.create({
    data: {
      email: 'test@obra.local',
      name: 'Test',
      role: 'ADMIN',
      mustChangePassword: false,
      passwordHash: hashPassword('Integration-test-only!'),
    },
  });
  api = spawn(process.execPath, [resolve('node_modules/tsx/dist/cli.mjs'), 'src/main.ts'], {
    cwd: resolve('apps/api'),
    env: { ...process.env, API_PORT: '4101', OPENAI_API_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  api.stdout?.on('data', (d) => (output += d));
  api.stderr?.on('data', (d) => (output += d));
  for (let i = 0; i < 60; i++) {
    try {
      const r = await req('health', undefined, undefined, false);
      if (r.status === 200) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('API de pruebas no inició: ' + output);
});
after(async () => {
  api?.kill('SIGTERM');
  await db.$disconnect();
});
test('requiere sesión y rechaza orígenes externos', async () => {
  assert.equal((await req('data', undefined, undefined, false)).status, 401);
  const r = await fetch(base + '/auth/login', {
    method: 'POST',
    headers: { Origin: 'https://example.invalid', 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@obra.local', password: 'Integration-test-only!' }),
  });
  assert.equal(r.status, 403);
});
test('autentica y entrega cookie HttpOnly', async () => {
  const r = await fetch(base + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@obra.local', password: 'Integration-test-only!' }),
  });
  assert.equal(r.status, 201);
  const set = r.headers.get('set-cookie')!;
  assert.match(set, /HttpOnly/i);
  cookie = set.split(';')[0];
  assert.equal((await req('data')).status, 200);
});
test('valida fechas y crea una obra de forma idempotente', async () => {
  const body = {
    code: 'TEST-001',
    name: 'Obra prueba',
    client: 'Cliente de prueba',
    location: 'Local',
    manager: 'Test',
    startDate: '2026-10-11',
    endDate: '2026-11-11',
  };
  assert.equal((await req('projects', { ...body, endDate: '2026-02-31' })).status, 400);
  const key = randomUUID();
  const a = await req('projects', body, key),
    b = await req('projects', body, key);
  assert.equal(a.status, 201);
  assert.equal(a.value.id, b.value.id);
  projectId = a.value.id;
  assert.equal((await req('projects', { ...body, name: 'Cambio' }, key)).status, 409);
  assert.equal(await db.project.count(), 1);
});
test('calcula APU y congela presupuesto aprobado', async () => {
  const body = {
    projectId,
    code: 'C-01',
    name: 'Concepto',
    unit: 'm2',
    quantity: 10,
    components: [
      { name: 'Material', quantity: 1.5, price: 100 },
      { name: 'Mano de obra', quantity: 0.25, price: 200 },
    ],
  };
  const r = await req('budget', body);
  assert.equal(r.status, 201);
  assert.equal(r.value.unitPrice, '200');
  assert.equal((await req(`projects/${projectId}/approve-budget`, {})).status, 201);
  assert.equal((await req('budget', { ...body, code: 'C-02' })).status, 409);
});
test('crea material y compra; recibir requiere aprobar', async () => {
  const m = await req('materials', {
    code: 'MAT-T',
    name: 'Material de prueba',
    unit: 'pza',
    type: 'MATERIAL',
    price: 10,
  });
  assert.equal(m.status, 201);
  materialId = m.value.id;
  const o = await req('orders', {
    projectId,
    supplier: 'Proveedor',
    expectedDate: '2026-10-20',
    lines: [{ materialId, quantity: 10, unitPrice: 10 }],
  });
  assert.equal(o.status, 201);
  orderId = o.value.id;
  lineId = o.value.lines[0].id;
  assert.equal(
    (await req(`orders/${orderId}/receive`, { lineId, quantity: 4, reference: 'R-1' })).status,
    409,
  );
  assert.equal((await req(`orders/${orderId}/approve`, {})).status, 201);
});
test('reintentos de recepción no duplican inventario', async () => {
  const key = randomUUID(),
    body = { lineId, quantity: 4, reference: 'R-1' };
  const [a, b] = await Promise.all([
    req(`orders/${orderId}/receive`, body, key),
    req(`orders/${orderId}/receive`, body, key),
  ]);
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);
  assert.equal((await db.stock.findFirst())?.quantity.toString(), '4');
  assert.equal(await db.movement.count(), 1);
});
test('recepciones concurrentes no superan el saldo', async () => {
  const r = await Promise.all([
    req(`orders/${orderId}/receive`, { lineId, quantity: 4, reference: 'R-2' }),
    req(`orders/${orderId}/receive`, { lineId, quantity: 4, reference: 'R-3' }),
  ]);
  assert.deepEqual(r.map((x) => x.status).sort(), [201, 409]);
  assert.equal((await db.stock.findFirst())?.quantity.toString(), '8');
});
test('salidas concurrentes no producen stock negativo', async () => {
  const r = await Promise.all([
    req('stock/consume', { projectId, materialId, quantity: 6, reference: 'Uso A' }),
    req('stock/consume', { projectId, materialId, quantity: 6, reference: 'Uso B' }),
  ]);
  assert.deepEqual(r.map((x) => x.status).sort(), [201, 409]);
  assert.equal((await db.stock.findFirst())?.quantity.toString(), '2');
});
test('pago limitado al material recibido y sin duplicados', async () => {
  assert.equal(
    (
      await req(`orders/${orderId}/pay`, {
        amount: 81,
        reference: 'P-0',
        method: 'Transferencia',
        paidAt: '2026-10-11',
      })
    ).status,
    409,
  );
  const key = randomUUID(),
    body = { amount: 30, reference: 'P-1', method: 'Transferencia', paidAt: '2026-10-11' };
  assert.equal((await req(`orders/${orderId}/pay`, body, key)).status, 201);
  assert.equal((await req(`orders/${orderId}/pay`, body, key)).status, 201);
  assert.equal(await db.payment.count(), 1);
  assert.equal((await req(`orders/${orderId}/pay`, body)).status, 409);
  const r = await Promise.all([
    req(`orders/${orderId}/pay`, { ...body, amount: 40, reference: 'P-2' }),
    req(`orders/${orderId}/pay`, { ...body, amount: 40, reference: 'P-3' }),
  ]);
  assert.deepEqual(r.map((x) => x.status).sort(), [201, 409]);
});
test('cierre y cancelación rechazan pendientes', async () => {
  assert.equal((await req(`orders/${orderId}/cancel`, {})).status, 409);
  assert.equal((await req(`projects/${projectId}/close`, {})).status, 409);
});
test('bitácoras conservan autor y se cierran una sola vez', async () => {
  const l = await req('logs', {
    projectId,
    date: '2026-10-11',
    title: 'Registro',
    activities: 'Trabajo de prueba',
    crew: 3,
    weather: 'Despejado',
  });
  assert.equal(l.status, 201);
  logId = l.value.id;
  assert.equal(l.value.author, 'Test');
  assert.equal((await req(`logs/${logId}/close`, {})).status, 201);
  assert.equal((await req(`logs/${logId}/close`, {})).status, 409);
});
test('una obra saldada puede cerrarse y bloquea movimientos nuevos', async () => {
  assert.equal(
    (await req(`orders/${orderId}/receive`, { lineId, quantity: 2, reference: 'R-final' })).status,
    201,
  );
  assert.equal(
    (await req('stock/consume', { projectId, materialId, quantity: 4, reference: 'Uso final' }))
      .status,
    201,
  );
  assert.equal(
    (
      await req(`orders/${orderId}/pay`, {
        amount: 30,
        reference: 'P-final',
        method: 'Transferencia',
        paidAt: '2026-10-11',
      })
    ).status,
    201,
  );
  assert.equal((await req(`projects/${projectId}/close`, {})).status, 201);
  assert.equal(
    (
      await req('orders', {
        projectId,
        supplier: 'Test',
        expectedDate: '2026-11-01',
        lines: [{ materialId, quantity: 1, unitPrice: 10 }],
      })
    ).status,
    409,
  );
  assert.ok((await db.audit.count()) > 10);
});
let origin = '',
  destination = '',
  transferId = '',
  needId = '';
test('abastecimiento: prepara obras y necesidades sin alterar existencias', async () => {
  const p = {
    client: 'Test',
    location: 'Local',
    manager: 'Test',
    startDate: '2026-10-12',
    endDate: '2026-12-31',
  };
  origin = (await req('projects', { ...p, code: 'SUP-01', name: 'Origen' })).value.id;
  destination = (await req('projects', { ...p, code: 'SUP-02', name: 'Destino' })).value.id;
  for (const [id, quantity, unitPrice] of [
    [origin, 20, 10],
    [destination, 10, 20],
  ] as [string, number, number][]) {
    const o = await req('orders', {
      projectId: id,
      supplier: 'Prueba',
      expectedDate: '2026-10-20',
      lines: [{ materialId, quantity, unitPrice }],
    });
    assert.equal(o.status, 201);
    await req(`orders/${o.value.id}/approve`, {});
    assert.equal(
      (
        await req(`orders/${o.value.id}/receive`, {
          lineId: o.value.lines[0].id,
          quantity,
          reference: 'Recepción inicial',
        })
      ).status,
      201,
    );
  }
  assert.equal(
    (
      await req('supply/needs', {
        projectId: destination,
        materialId,
        quantity: 15,
        neededOn: '2026-02-31',
        leadDays: 5,
        purpose: 'Prueba',
      })
    ).status,
    400,
  );
  const body = {
      projectId: destination,
      materialId,
      quantity: 15,
      neededOn: '2026-12-01',
      leadDays: 5,
      purpose: 'Cimentación',
    },
    key = randomUUID();
  const n = await req('supply/needs', body, key);
  assert.equal(n.status, 201);
  needId = n.value.id;
  assert.equal((await req('supply/needs', body, key)).value.id, needId);
  const data = (await req('data')).value;
  assert.equal(data.coverage.find((c: any) => c.needId === needId).shortage, '5');
});
test('sobrantes: cantidades válidas, consumo local separado y alternativas', async () => {
  assert.equal(
    (await req('stock/release', { projectId: origin, materialId, quantity: 21, reason: 'Exceso' }))
      .status,
    409,
  );
  assert.equal(
    (
      await req('stock/release', {
        projectId: origin,
        materialId,
        quantity: 8,
        reason: 'Sobrante de frente',
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await req('stock/consume', {
        projectId: origin,
        materialId,
        quantity: 13,
        reference: 'No debe consumir liberados',
      })
    ).status,
    409,
  );
  const data = (await req('data')).value;
  assert.equal(data.coverage.find((c: any) => c.needId === needId).alternatives[0].available, '8');
  assert.equal(
    (
      await req('stock/transfers', {
        fromProjectId: origin,
        toProjectId: origin,
        materialId,
        quantity: 1,
        reference: 'Misma obra',
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await req('stock/transfers', {
        fromProjectId: origin,
        toProjectId: destination,
        materialId,
        quantity: 9,
        reference: 'Exceso',
      })
    ).status,
    409,
  );
});
test('traspaso: despacho idempotente reduce origen y mantiene destino hasta recibir', async () => {
  const key = randomUUID(),
    body = {
      fromProjectId: origin,
      toProjectId: destination,
      materialId,
      quantity: 5,
      reference: 'Salida TR prueba',
    };
  const [a, b] = await Promise.all([
    req('stock/transfers', body, key),
    req('stock/transfers', body, key),
  ]);
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);
  assert.equal(a.value.id, b.value.id);
  transferId = a.value.id;
  assert.equal(
    (
      await db.stock.findUnique({
        where: { projectId_materialId: { projectId: origin, materialId } },
      })
    )?.quantity.toString(),
    '15',
  );
  assert.equal(
    (
      await db.stock.findUnique({
        where: { projectId_materialId: { projectId: origin, materialId } },
      })
    )?.released.toString(),
    '3',
  );
  assert.equal(
    (
      await db.stock.findUnique({
        where: { projectId_materialId: { projectId: destination, materialId } },
      })
    )?.quantity.toString(),
    '10',
  );
  assert.equal(
    (await req('data')).value.coverage.find((c: any) => c.needId === needId).shortage,
    '5',
  );
});
test('traspaso: recepción idempotente conserva costo y no crea pagos', async () => {
  const payments = await db.payment.count();
  const orders = await db.purchaseOrder.count();
  const key = randomUUID();
  const [a, b] = await Promise.all([
    req(`stock/transfers/${transferId}/receive`, { reference: 'Llegada completa' }, key),
    req(`stock/transfers/${transferId}/receive`, { reference: 'Llegada completa' }, key),
  ]);
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);
  const stock = await db.stock.findUnique({
    where: { projectId_materialId: { projectId: destination, materialId } },
  });
  assert.equal(stock?.quantity.toString(), '15');
  assert.equal(stock?.averageCost.toString(), '16.6667');
  assert.equal(await db.payment.count(), payments);
  assert.equal(await db.purchaseOrder.count(), orders);
  assert.equal(
    (await req(`stock/transfers/${transferId}/receive`, { reference: 'Segunda recepción' })).status,
    409,
  );
  assert.equal(
    (await req('data')).value.coverage.find((c: any) => c.needId === needId).shortage,
    '0',
  );
});
test('despachos concurrentes no superan los sobrantes disponibles', async () => {
  const body = {
    fromProjectId: origin,
    toProjectId: destination,
    materialId,
    quantity: 2,
    reference: 'Concurrente',
  };
  const r = await Promise.all([req('stock/transfers', body), req('stock/transfers', body)]);
  assert.deepEqual(r.map((x) => x.status).sort(), [201, 409]);
  const stock = await db.stock.findUnique({
    where: { projectId_materialId: { projectId: origin, materialId } },
  });
  assert.equal(stock?.released.toString(), '1');
  assert.equal(stock?.quantity.toString(), '13');
});
test('el consumo ligado valida obra, material y saldo; cierra la necesidad al completar', async () => {
  assert.equal(
    (
      await req('stock/consume', {
        projectId: origin,
        materialId,
        needId,
        quantity: 1,
        reference: 'Obra incorrecta',
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await req('stock/consume', {
        projectId: destination,
        materialId,
        needId,
        quantity: 10,
        reference: 'Frente 1',
      })
    ).status,
    201,
  );
  assert.equal(
    (await db.supplyNeed.findUnique({ where: { id: needId } }))?.consumed.toString(),
    '10',
  );
  const r = await Promise.all([
    req('stock/consume', {
      projectId: destination,
      materialId,
      needId,
      quantity: 5,
      reference: 'Fin A',
    }),
    req('stock/consume', {
      projectId: destination,
      materialId,
      needId,
      quantity: 5,
      reference: 'Fin B',
    }),
  ]);
  assert.deepEqual(r.map((x) => x.status).sort(), [201, 409]);
  assert.equal((await db.supplyNeed.findUnique({ where: { id: needId } }))?.status, 'FULFILLED');
});
test('cancelación no mueve material y cierre bloquea necesidades o tránsito', async () => {
  const p = await req('projects', {
    code: 'SUP-03',
    name: 'Solo planificación',
    client: 'Test',
    location: 'Local',
    manager: 'Test',
    startDate: '2026-10-12',
    endDate: '2026-12-31',
  });
  const n = await req('supply/needs', {
    projectId: p.value.id,
    materialId,
    quantity: 1,
    neededOn: '2026-12-01',
    leadDays: 0,
    purpose: 'Plan cancelable',
  });
  assert.equal((await req(`projects/${p.value.id}/close`, {})).status, 409);
  const count = await db.movement.count();
  assert.equal(
    (await req(`supply/needs/${n.value.id}/cancel`, { reason: 'Cambio de programa' })).status,
    201,
  );
  assert.equal(await db.movement.count(), count);
  assert.equal((await req(`supply/needs/${n.value.id}/cancel`, { reason: 'Repetir' })).status, 409);
  // An incoming transfer blocks closure even when destination has no stock, debt or open need.
  const tr = await req('stock/transfers', {
    fromProjectId: origin,
    toProjectId: p.value.id,
    materialId,
    quantity: 1,
    reference: 'Tránsito bloquea cierre',
  });
  assert.equal(tr.status, 201);
  assert.equal((await req(`projects/${p.value.id}/close`, {})).status, 409);
  assert.equal(
    (await req(`stock/transfers/${tr.value.id}/receive`, { reference: 'Entrega' })).status,
    201,
  );
  assert.equal(
    (
      await req('stock/consume', {
        projectId: p.value.id,
        materialId,
        quantity: 1,
        reference: 'Consumo final',
      })
    ).status,
    201,
  );
  assert.equal((await req(`projects/${p.value.id}/close`, {})).status, 201);
  assert.equal(
    (
      await req('supply/needs', {
        projectId: p.value.id,
        materialId,
        quantity: 1,
        neededOn: '2026-12-01',
        leadDays: 0,
        purpose: 'No admitir',
      })
    ).status,
    409,
  );
});

let evidenceLog = '',
  evidenceId = '',
  adendumId = '';
const evidencePng =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const evidenceBody = {
  name: 'foto.png',
  mime: 'image/png',
  base64: evidencePng,
  caption: 'Frente A',
};
test('bitácora asocia frente y solo conceptos de su obra', async () => {
  const body = {
    projectId: origin,
    date: '2026-10-13',
    title: 'Evidencia',
    activities: 'Registro original',
    crew: 2,
    weather: 'Despejado',
    front: 'Frente A',
  };
  const other = await db.budgetItem.findFirst({ where: { projectId } });
  assert.equal((await req('logs', { ...body, budgetItemId: other!.id })).status, 400);
  const r = await req('logs', body);
  assert.equal(r.status, 201);
  evidenceLog = r.value.id;
  assert.equal(r.value.front, 'Frente A');
});
test('evidencia privada e idempotente, contenido excluido del listado', async () => {
  const key = randomUUID(),
    path = 'logs/' + evidenceLog + '/attachments';
  const a = await req(path, evidenceBody, key),
    b = await req(path, evidenceBody, key);
  assert.equal(a.status, 201);
  assert.equal(a.value.id, b.value.id);
  evidenceId = a.value.id;
  assert.equal(a.value.content, undefined);
  assert.equal((await req(path, evidenceBody)).status, 409);
  assert.equal((await req(path, { ...evidenceBody, mime: 'image/jpeg' })).status, 400);
  const url = base + '/' + path + '/' + evidenceId;
  assert.equal((await fetch(url)).status, 401);
  const read = await fetch(url, { headers: { Cookie: cookie } });
  assert.equal(read.status, 200);
  assert.equal(read.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(Buffer.from(await read.arrayBuffer()), Buffer.from(evidencePng, 'base64'));
  const range = await fetch(url, { headers: { Cookie: cookie, Range: 'bytes=0-7' } });
  assert.equal(range.status, 206);
  assert.equal((await range.arrayBuffer()).byteLength, 8);
  assert.equal(
    (await fetch(url, { headers: { Cookie: cookie, Range: 'bytes=9999-' } })).status,
    416,
  );
  assert.equal((await req('logs/not-this-log/attachments/' + evidenceId)).status, 404);
  const list = (await req('data')).value;
  assert.equal(list.capabilities.transcription, false);
  assert.equal(list.logs.find((l: any) => l.id === evidenceLog).attachments[0].content, undefined);
});
test('cierre conserva original y permite evidencia solo mediante adendas', async () => {
  assert.equal((await req('logs/' + evidenceLog + '/close', {})).status, 201);
  assert.equal((await req('logs/' + evidenceLog + '/attachments', evidenceBody)).status, 409);
  const r = await req('logs/' + evidenceLog + '/addenda', {
    text: 'Aclaración posterior',
    author: 'Impostor',
  });
  assert.equal(r.status, 201);
  assert.equal(r.value.author, 'Test');
  adendumId = r.value.id;
  const different = {
    ...evidenceBody,
    base64: Buffer.concat([Buffer.from(evidencePng, 'base64'), Buffer.from([0])]).toString(
      'base64',
    ),
    addendumId: adendumId,
  };
  assert.equal((await req('logs/' + evidenceLog + '/attachments', different)).status, 201);
  assert.equal((await req('logs/' + logId + '/attachments', different)).status, 409); // obra cerrada
  assert.equal(
    (await db.siteLog.findUnique({ where: { id: evidenceLog } }))!.activities,
    'Registro original',
  );
  assert.equal(
    await db.logAttachment.count({ where: { logId: evidenceLog, addendumId: null } }),
    1,
  );
});
test('audio se conserva sin configurar transcripción; publicar requiere fuente lista', async () => {
  const wav = Buffer.alloc(48);
  wav.write('RIFF');
  wav.write('WAVE', 8);
  const r = await req('logs/' + evidenceLog + '/attachments', {
    name: 'nota.wav',
    mime: 'audio/wav',
    base64: wav.toString('base64'),
    caption: 'Nota de prueba',
    addendumId: adendumId,
  });
  assert.equal(r.status, 201);
  assert.equal(
    (
      await req('logs/' + evidenceLog + '/attachments/' + r.value.id + '/transcribe', {
        sendToOpenAI: true,
      })
    ).status,
    503,
  );
  assert.equal(
    (await req('logs/' + evidenceLog + '/attachments/' + r.value.id + '/transcribe', {})).status,
    400,
  );
  assert.equal(
    (
      await req('logs/' + evidenceLog + '/addenda', {
        text: 'Texto',
        sourceAttachmentId: r.value.id,
      })
    ).status,
    400,
  );
  await db.logAttachment.update({
    where: { id: r.value.id },
    data: { transcript: 'Texto automático', transcriptionStatus: 'READY' },
  });
  const body = { text: 'Texto revisado', sourceAttachmentId: r.value.id };
  assert.equal((await req('logs/' + evidenceLog + '/addenda', body)).status, 201);
  assert.equal((await req('logs/' + evidenceLog + '/addenda', body)).status, 409);
});

let planProject = '',
  drawingId = '',
  planVersionId = '',
  planIssueId = '',
  planIssueRevision = 0,
  planPdf = '';
async function makePlanPdf(width = 600, pages = 2) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([width, 400]);
  return Buffer.from(await doc.save()).toString('base64');
}
test('planos: carga PDF privada y metadatos idempotentes sin bytes', async () => {
  const p = await req('projects', {
    code: 'PL-TEST',
    name: 'Prueba planos',
    client: 'Test',
    location: 'Local',
    manager: 'Test',
    startDate: '2026-10-13',
    endDate: '2026-12-31',
  });
  planProject = p.value.id;
  planPdf = await makePlanPdf();
  const body = {
    projectId: planProject,
    code: 'ARQ-01',
    title: 'Planta',
    name: 'plano.pdf',
    base64: planPdf,
    label: 'A',
    note: 'Inicial',
    pageCount: 999,
  };
  assert.equal(
    (await req('drawings', { ...body, base64: Buffer.from('not PDF').toString('base64') })).status,
    400,
  );
  const key = randomUUID(),
    a = await req('drawings', body, key),
    b = await req('drawings', body, key);
  assert.equal(a.status, 201);
  assert.equal(a.value.id, b.value.id);
  drawingId = a.value.id;
  planVersionId = a.value.versions[0].id;
  assert.equal(a.value.versions[0].pageCount, 2);
  assert.equal(a.value.versions[0].content, undefined);
  const path = 'drawings/' + drawingId + '/versions/' + planVersionId + '/file';
  assert.equal((await req(path, undefined, undefined, false)).status, 401);
  const file = await fetch(base + '/' + path, { headers: { Cookie: cookie } });
  assert.equal(file.status, 200);
  assert.match(file.headers.get('content-disposition')!, /^attachment/);
  assert.deepEqual(Buffer.from(await file.arrayBuffer()), Buffer.from(planPdf, 'base64'));
  assert.equal((await req('drawings/wrong/versions/' + planVersionId + '/file')).status, 404);
});
test('marcadores: límites de página, coordenadas, autor y cierre de obra', async () => {
  const path = 'drawings/' + drawingId + '/versions/' + planVersionId + '/issues';
  const body = {
    page: 2,
    x: 0.25,
    y: 0.75,
    title: 'Revisar encuentro',
    description: 'Pendiente en plano',
    assignee: 'Residente',
    dueDate: '2026-10-20',
    priority: 'HIGH',
    author: 'Suplantación',
  };
  assert.equal((await req(path, { ...body, page: 3 })).status, 400);
  assert.equal((await req(path, { ...body, x: 1.1 })).status, 400);
  assert.equal(
    (await req('drawings/wrong/versions/' + planVersionId + '/issues', body)).status,
    404,
  );
  const key = randomUUID(),
    a = await req(path, body, key),
    b = await req(path, body, key);
  assert.equal(a.status, 201);
  assert.equal(a.value.id, b.value.id);
  assert.equal(a.value.author, 'Test');
  planIssueId = a.value.id;
  assert.equal(a.value.events.length, 1);
  assert.equal((await req('projects/' + planProject + '/close', {})).status, 409);
});
test('versiones nuevas conservan incidencias y coordenadas de origen', async () => {
  const path = 'drawings/' + drawingId + '/versions',
    body = { name: 'rev.pdf', label: 'B', note: 'Cambio', base64: planPdf };
  assert.equal((await req(path, body)).status, 409);
  const results = await Promise.all([
    req(path, { ...body, base64: await makePlanPdf(620, 1) }),
    req(path, { ...body, label: 'C', base64: await makePlanPdf(640, 3) }),
  ]);
  assert.deepEqual(
    results.map((r) => r.status),
    [201, 201],
  );
  assert.deepEqual(results.map((r) => r.value.number).sort(), [2, 3]);
  const issue = await db.planIssue.findUnique({ where: { id: planIssueId } });
  assert.equal(issue!.versionId, planVersionId);
  assert.equal(issue!.page, 2);
  assert.equal(issue!.x, 0.25);
  assert.equal(issue!.y, 0.75);
  const data = (await req('data')).value;
  assert.equal(data.drawings.find((d: any) => d.id === drawingId).versions[0].number, 3);
  assert.equal(
    data.drawings.find((d: any) => d.id === drawingId).versions.some((v: any) => 'content' in v),
    false,
  );
});
test('seguimiento concurrente evita sobrescribir cambios y admite reasignación', async () => {
  const path = 'plan-issues/' + planIssueId + '/events',
    body = { action: 'START', expectedRevision: 0, note: 'En proceso' };
  const results = await Promise.all([req(path, body), req(path, body)]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  planIssueRevision = 1;
  assert.equal(
    (await req(path, { action: 'ASSIGN', expectedRevision: 1, note: 'Nuevo turno' })).status,
    400,
  );
  const reassigned = await req(path, {
    action: 'ASSIGN',
    expectedRevision: 1,
    note: 'Nuevo turno',
    assignee: 'Supervisión',
    dueDate: '2026-10-22',
  });
  assert.equal(reassigned.status, 201);
  assert.equal(reassigned.value.assignee, 'Supervisión');
  planIssueRevision = 2;
});
test('resolución exige foto; conserva evidencia autenticada y reabre con historial', async () => {
  const path = 'plan-issues/' + planIssueId + '/events';
  assert.equal(
    (await req(path, { action: 'RESOLVE', expectedRevision: 2, note: 'Resuelto' })).status,
    400,
  );
  const body = {
      action: 'RESOLVE',
      expectedRevision: 2,
      note: 'Corrección comprobada',
      evidence: [{ name: 'resuelto.png', mime: 'image/png', base64: evidencePng }],
    },
    key = randomUUID();
  const a = await req(path, body, key),
    b = await req(path, body, key);
  assert.equal(a.status, 201);
  assert.equal(a.value.revision, 3);
  assert.equal(a.value.id, b.value.id);
  const event = a.value.events.find((e: any) => e.action === 'RESOLVE');
  assert.equal(event.evidence[0].content, undefined);
  const url = base + '/plan-issues/' + planIssueId + '/evidence/' + event.evidence[0].id;
  assert.equal((await fetch(url)).status, 401);
  const image = await fetch(url, { headers: { Cookie: cookie } });
  assert.equal(image.status, 200);
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), Buffer.from(evidencePng, 'base64'));
  assert.equal((await req('plan-issues/other/evidence/' + event.evidence[0].id)).status, 404);
  const reopened = await req(path, {
    action: 'REOPEN',
    expectedRevision: 3,
    note: 'Se requiere revisar otra vez',
  });
  assert.equal(reopened.status, 201);
  assert.equal(reopened.value.status, 'OPEN');
  assert.equal(reopened.value.events.length, 5);
  assert.equal(reopened.value.versionId, planVersionId);
  assert.equal((await req(path, { ...body, expectedRevision: 4 })).status, 201);
  assert.equal((await req('projects/' + planProject + '/close', {})).status, 201);
  assert.equal(
    (await req(path, { action: 'COMMENT', expectedRevision: 5, note: 'Obra cerrada' })).status,
    409,
  );
  assert.equal(
    (
      await req('drawings/' + drawingId + '/versions', {
        name: 'c.pdf',
        base64: await makePlanPdf(660),
        label: 'D',
        note: 'No permitido',
      })
    ).status,
    409,
  );
  assert.equal(
    (await req('data')).value.planIssues
      .find((i: any) => i.id === planIssueId)
      .events.some((e: any) => e.evidence.some((f: any) => 'content' in f)),
    false,
  );
});

let changeProject = '',
  changeId = '',
  changeRevision = 0,
  creditId = '';
const proposal = {
  scope: 'Ampliación de prueba',
  costDelta: '30.00',
  priceDelta: '50.00',
  daysDelta: 2,
};
async function changeAction(action: string, extra: any = {}) {
  const r = await req('changes/' + changeId + '/actions', {
    action,
    expectedRevision: changeRevision,
    note: 'Prueba ' + action,
    ...extra,
  });
  if (r.status === 201) changeRevision = r.value.revision;
  return r;
}
test('cambios: propuestas no alteran presupuesto ni plazo y requieren línea base para aprobar', async () => {
  const p = await req('projects', {
    code: 'CH-TEST',
    name: 'Cambios prueba',
    client: 'Test',
    location: 'Local',
    manager: 'Test',
    startDate: '2026-10-01',
    endDate: '2026-10-31',
  });
  changeProject = p.value.id;
  await req('budget', {
    projectId: changeProject,
    code: 'B-01',
    name: 'Base',
    unit: 'pza',
    quantity: 1,
    components: [{ name: 'Trabajo', quantity: 1, price: 100 }],
  });
  const body = {
      projectId: changeProject,
      title: 'Cambio prueba',
      reason: 'Necesidad ficticia',
      proposal,
    },
    key = randomUUID();
  const a = await req('changes', body, key),
    b = await req('changes', body, key);
  assert.equal(a.status, 201);
  assert.equal(a.value.id, b.value.id);
  changeId = a.value.id;
  let project = (await req('data')).value.projects.find((p: any) => p.id === changeProject);
  assert.equal(project.changeSummary.adjustedBudget, '100.00');
  assert.equal(project.changeSummary.approvedDaysDelta, 0);
  assert.equal((await changeAction('SUBMIT')).status, 201);
  assert.equal(
    (await changeAction('APPROVE', { authorizationBy: 'Cliente', authorizationReference: 'REF-1' }))
      .status,
    409,
  );
  assert.equal((await req('projects/' + changeProject + '/approve-budget', {})).status, 201);
  assert.equal((await req('projects/' + changeProject + '/close', {})).status, 409);
});
test('rechazar y revisar conserva propuestas; autorización fija revisión y actor', async () => {
  assert.equal((await changeAction('REJECT')).status, 201);
  assert.equal(
    (
      await changeAction('REVISE', {
        proposal: { ...proposal, costDelta: '40.00', priceDelta: '60.00', daysDelta: 3 },
      })
    ).status,
    201,
  );
  assert.equal((await changeAction('SUBMIT')).status, 201);
  assert.equal((await changeAction('APPROVE')).status, 400);
  const r = await changeAction('APPROVE', {
    authorizationBy: 'Cliente externo declarado',
    authorizationReference: 'AUT-01',
  });
  assert.equal(r.status, 201);
  assert.equal(r.value.proposals.length, 2);
  assert.equal(r.value.proposals[0].number, 2);
  assert.equal(r.value.events.find((e: any) => e.action === 'APPROVE').actor, 'Test');
  const p = (await req('data')).value.projects.find((p: any) => p.id === changeProject);
  assert.equal(p.changeSummary.adjustedBudget, '140.00');
  assert.equal(p.changeSummary.approvedPriceDelta, '60.00');
  assert.equal(p.changeSummary.adjustedEndDate.slice(0, 10), '2026-11-03');
  assert.equal(p.endDate.slice(0, 10), '2026-10-31');
  assert.equal(p.budgetItems[0].unitPrice, '100');
  assert.equal((await changeAction('REVISE', { proposal })).status, 409);
  assert.equal((await changeAction('CANCEL')).status, 409);
});
test('avance concurrente no sobrescribe, y cobros idempotentes respetan el saldo', async () => {
  const body = {
    action: 'PROGRESS',
    expectedRevision: changeRevision,
    note: 'Avance',
    progress: 50,
  };
  const results = await Promise.all([
    req('changes/' + changeId + '/actions', body),
    req('changes/' + changeId + '/actions', { ...body, progress: 60 }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  changeRevision = results.find((r) => r.status === 201)!.value.revision;
  assert.equal((await changeAction('PROGRESS', { progress: 101 })).status, 400);
  const settlement = {
      action: 'SETTLEMENT',
      expectedRevision: changeRevision,
      note: 'Cobro parcial',
      amount: '20.00',
      reference: 'CO-01',
      date: '2026-10-15',
    },
    key = randomUUID();
  const a = await req('changes/' + changeId + '/actions', settlement, key),
    b = await req('changes/' + changeId + '/actions', settlement, key);
  assert.equal(a.status, 201);
  assert.equal(a.value.revision, b.value.revision);
  changeRevision = a.value.revision;
  assert.equal(a.value.outstanding, '40.00');
  assert.equal(
    (await changeAction('SETTLEMENT', { amount: '1', reference: 'CO-01', date: '2026-10-15' }))
      .status,
    409,
  );
  const remaining = {
    action: 'SETTLEMENT',
    expectedRevision: changeRevision,
    note: 'Cobro concurrente',
    amount: '30',
    date: '2026-10-15',
  };
  const rr = await Promise.all([
    req('changes/' + changeId + '/actions', { ...remaining, reference: 'CO-02' }),
    req('changes/' + changeId + '/actions', { ...remaining, reference: 'CO-03' }),
  ]);
  assert.deepEqual(rr.map((r) => r.status).sort(), [201, 409]);
  changeRevision = rr.find((r) => r.status === 201)!.value.revision;
  assert.equal(
    (await changeAction('SETTLEMENT', { amount: '11', reference: 'CO-04', date: '2026-10-15' }))
      .status,
    409,
  );
  assert.equal(
    (await changeAction('SETTLEMENT', { amount: '10', reference: 'CO-04', date: '2026-10-15' }))
      .status,
    201,
  );
  assert.equal((await req('projects/' + changeProject + '/close', {})).status, 409);
  assert.equal((await changeAction('PROGRESS', { progress: 100 })).status, 201);
});
test('aprobaciones concurrentes no permiten presupuesto ajustado negativo', async () => {
  const ids: string[] = [];
  for (let i = 0; i < 2; i++) {
    const c = await req('changes', {
      projectId: changeProject,
      title: 'Reducción ' + i,
      reason: 'Prueba límite',
      proposal: { scope: 'Reducción', costDelta: '-80', priceDelta: '0', daysDelta: 0 },
    });
    ids.push(c.value.id);
    assert.equal(
      (
        await req('changes/' + c.value.id + '/actions', {
          action: 'SUBMIT',
          expectedRevision: 0,
          note: 'Proponer',
        })
      ).status,
      201,
    );
  }
  const results = await Promise.all(
    ids.map((id) =>
      req('changes/' + id + '/actions', {
        action: 'APPROVE',
        expectedRevision: 1,
        note: 'Autorizar',
        authorizationBy: 'Cliente',
        authorizationReference: 'RED',
      }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  const yes = results.findIndex((r) => r.status === 201),
    no = 1 - yes;
  assert.equal(
    (
      await req('changes/' + ids[yes] + '/actions', {
        action: 'PROGRESS',
        expectedRevision: 2,
        note: 'Terminado',
        progress: 100,
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await req('changes/' + ids[no] + '/actions', {
        action: 'CANCEL',
        expectedRevision: 1,
        note: 'No procede',
      })
    ).status,
    201,
  );
  const p = (await req('data')).value.projects.find((p: any) => p.id === changeProject);
  assert.equal(p.changeSummary.adjustedBudget, '60.00');
});
test('reducciones de plazo inválidas se rechazan; créditos tienen saldo independiente', async () => {
  const c = await req('changes', {
    projectId: changeProject,
    title: 'Crédito',
    reason: 'Prueba',
    proposal: { scope: 'Crédito al cliente', costDelta: '0', priceDelta: '-25', daysDelta: -100 },
  });
  creditId = c.value.id;
  const path = 'changes/' + creditId + '/actions';
  assert.equal(
    (await req(path, { action: 'SUBMIT', expectedRevision: 0, note: 'Proponer' })).status,
    201,
  );
  assert.equal(
    (
      await req(path, {
        action: 'APPROVE',
        expectedRevision: 1,
        note: 'Autorizar',
        authorizationBy: 'Cliente',
        authorizationReference: 'CR-1',
      })
    ).status,
    409,
  );
  assert.equal(
    (await req(path, { action: 'REJECT', expectedRevision: 1, note: 'Corregir plazo' })).status,
    201,
  );
  assert.equal(
    (
      await req(path, {
        action: 'REVISE',
        expectedRevision: 2,
        note: 'Plazo corregido',
        proposal: {
          scope: 'Crédito sin cambio de plazo',
          costDelta: '0',
          priceDelta: '-25',
          daysDelta: 0,
        },
      })
    ).status,
    201,
  );
  assert.equal(
    (await req(path, { action: 'SUBMIT', expectedRevision: 3, note: 'Enviar' })).status,
    201,
  );
  const approved = await req(path, {
    action: 'APPROVE',
    expectedRevision: 4,
    note: 'Autorizar',
    authorizationBy: 'Cliente',
    authorizationReference: 'CR-2',
  });
  assert.equal(approved.status, 201);
  assert.equal(approved.value.settlementKind, 'CREDIT');
  assert.equal(approved.value.outstanding, '25.00');
  assert.equal(
    (
      await req(path, {
        action: 'SETTLEMENT',
        expectedRevision: 5,
        note: 'Crédito aplicado',
        amount: '25',
        reference: 'NC-01',
        date: '2026-10-15',
      })
    ).status,
    201,
  );
  assert.equal(
    (await req(path, { action: 'PROGRESS', expectedRevision: 6, note: 'Ejecutado', progress: 100 }))
      .status,
    201,
  );
  assert.equal((await req('projects/' + changeProject + '/close', {})).status, 201);
  assert.equal((await changeAction('PROGRESS', { progress: 90 })).status, 409);
  assert.equal(
    (
      await req('changes', {
        projectId: changeProject,
        title: 'No permitir',
        reason: 'Cerrada',
        proposal,
      })
    ).status,
    409,
  );
  assert.equal(await db.movement.count({ where: { projectId: changeProject } }), 0);
  assert.equal(await db.purchaseOrder.count({ where: { projectId: changeProject } }), 0);
});
let docProject = '',
  docId = '',
  docOrder = '',
  docLine = '';
const reviewedDoc = {
  kind: 'QUOTE',
  supplier: 'Proveedor documental',
  folio: 'COT-DOC-1',
  date: '2026-10-15',
  currency: 'MXN',
  note: 'Datos ficticios cotejados',
  subtotal: 100,
  tax: 16,
  total: 116,
  lines: [] as any[],
};
async function uploadTestDocument(tag: string, p = docProject) {
  const pdf = await PDFDocument.create();
  pdf.addPage().drawText(tag);
  return req('documents', {
    projectId: p,
    name: tag + '.pdf',
    mime: 'application/pdf',
    base64: Buffer.from(await pdf.save()).toString('base64'),
  });
}
test('documentos: original privado, idempotencia y duplicados por archivo', async () => {
  docProject = (
    await req('projects', {
      code: 'DOC-TEST',
      name: 'Documentos',
      client: 'Demo',
      location: 'Local',
      manager: 'Test',
      startDate: '2026-10-01',
      endDate: '2026-12-31',
    })
  ).value.id;
  const pdf = await PDFDocument.create();
  pdf.addPage().drawText('Cotizacion ficticia');
  const body = {
      projectId: docProject,
      name: 'cotizacion.pdf',
      mime: 'application/pdf',
      base64: Buffer.from(await pdf.save()).toString('base64'),
    },
    key = randomUUID();
  const a = await req('documents', body, key),
    b = await req('documents', body, key);
  assert.equal(a.status, 201);
  docId = a.value.id;
  assert.equal(b.value.id, docId);
  assert.equal(a.value.content, undefined);
  assert.equal((await req('documents', body)).status, 409);
  const privateFile = await fetch(base + `/documents/${docId}/file`);
  assert.equal(privateFile.status, 401);
  const f = await fetch(base + `/documents/${docId}/file`, { headers: { Cookie: cookie } });
  assert.equal(f.status, 200);
  assert.match(f.headers.get('cache-control')!, /no-store/);
  assert.equal(Buffer.from(await f.arrayBuffer()).toString('base64'), body.base64);
  assert.equal(
    (await req(`documents/${docId}/extract`, { consent: true, expectedRevision: 0 })).status,
    503,
  );
  assert.equal(
    (await req('data')).value.documents.find((d: any) => d.id === docId).content,
    undefined,
  );
});
test('documentos: revisión exige unidad, totales, confirmación y revisión vigente', async () => {
  reviewedDoc.lines = [
    { description: 'Material de prueba', materialId, unit: 'pza', quantity: 10, unitPrice: 10 },
  ];
  const path = `documents/${docId}/review`;
  assert.equal(
    (await req(path, { expectedRevision: 0, confirmed: false, review: reviewedDoc })).status,
    400,
  );
  assert.equal(
    (
      await req(path, {
        expectedRevision: 0,
        confirmed: true,
        review: { ...reviewedDoc, subtotal: 1 },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await req(path, {
        expectedRevision: 0,
        confirmed: true,
        review: { ...reviewedDoc, lines: [{ ...reviewedDoc.lines[0], unit: 'kg' }] },
      })
    ).status,
    400,
  );
  const r = await req(path, { expectedRevision: 0, confirmed: true, review: reviewedDoc });
  assert.equal(r.status, 201);
  assert.equal(r.value.status, 'REVIEWED');
  assert.equal(
    (await req(path, { expectedRevision: 0, confirmed: true, review: reviewedDoc })).status,
    409,
  );
  assert.equal(await db.purchaseOrder.count({ where: { projectId: docProject } }), 0);
  assert.equal(await db.movement.count({ where: { projectId: docProject } }), 0);
  const dup = await uploadTestDocument('Copia con otro escaneo');
  assert.equal(
    (
      await req(`documents/${dup.value.id}/review`, {
        expectedRevision: 0,
        confirmed: true,
        review: { ...reviewedDoc, supplier: ' PROVEEDOR DOCUMENTAL ' },
      })
    ).status,
    409,
  );
});
test('documentos: corrección conserva historial; cotización crea solo una compra en borrador', async () => {
  assert.equal(
    (await req(`documents/${docId}/reopen`, { expectedRevision: 1, note: 'Revisar' })).status,
    201,
  );
  assert.equal(
    (
      await req(`documents/${docId}/review`, {
        expectedRevision: 2,
        confirmed: true,
        review: reviewedDoc,
      })
    ).status,
    201,
  );
  const key = randomUUID(),
    body = { expectedRevision: 3, confirmed: true, expectedDate: '2026-10-30' };
  const [a, b] = await Promise.all([
    req(`documents/${docId}/apply`, body, key),
    req(`documents/${docId}/apply`, body, key),
  ]);
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);
  assert.equal(a.value.orderId, b.value.orderId);
  docOrder = a.value.orderId;
  const o = await db.purchaseOrder.findUniqueOrThrow({
    where: { id: docOrder },
    include: { lines: true },
  });
  assert.equal(o.status, 'DRAFT');
  docLine = o.lines[0].id;
  assert.equal(o.lines[0].quantity.toString(), '10');
  assert.equal(await db.movement.count({ where: { projectId: docProject } }), 0);
  assert.equal((await req(`documents/${docId}/apply`, body)).status, 409);
  assert.equal(
    (await req(`documents/${docId}/reopen`, { expectedRevision: 4, note: 'No permitido' })).status,
    409,
  );
  assert.equal(await db.documentEvent.count({ where: { documentId: docId, action: 'REVIEW' } }), 2);
});
test('documentos: remisión exige compra de la obra, precio y saldo; concurrencia no duplica inventario', async () => {
  const a = await uploadTestDocument('Remision A'),
    b = await uploadTestDocument('Remision B');
  const ids = [a.value.id, b.value.id];
  for (let i = 0; i < 2; i++)
    assert.equal(
      (
        await req(`documents/${ids[i]}/review`, {
          expectedRevision: 0,
          confirmed: true,
          review: {
            ...reviewedDoc,
            kind: 'DELIVERY',
            folio: 'REM-' + i,
            subtotal: 60,
            tax: null,
            total: null,
            lines: [{ ...reviewedDoc.lines[0], quantity: 6 }],
          },
        })
      ).status,
      201,
    );
  const apply = { expectedRevision: 1, confirmed: true, orderId: docOrder, lineIds: [docLine] };
  assert.equal((await req(`documents/${ids[0]}/apply`, apply)).status, 409);
  assert.equal((await req(`documents/${ids[0]}/apply`, { ...apply, orderId })).status, 400);
  assert.equal((await req(`orders/${docOrder}/approve`, {})).status, 201);
  const results = await Promise.all(ids.map((id) => req(`documents/${id}/apply`, apply)));
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  assert.equal(
    (
      await db.stock.findUniqueOrThrow({
        where: { projectId_materialId: { projectId: docProject, materialId } },
      })
    ).quantity.toString(),
    '6',
  );
  assert.equal(await db.movement.count({ where: { projectId: docProject } }), 1);
  const winner = ids[results.findIndex((r) => r.status === 201)];
  assert.equal((await req(`documents/${winner}/apply`, apply)).status, 409);
  const mismatch = await uploadTestDocument('Remision precio distinto');
  assert.equal(
    (
      await req(`documents/${mismatch.value.id}/review`, {
        expectedRevision: 0,
        confirmed: true,
        review: {
          ...reviewedDoc,
          kind: 'DELIVERY',
          folio: 'PRECIO',
          subtotal: 11,
          tax: null,
          total: null,
          lines: [{ ...reviewedDoc.lines[0], quantity: 1, unitPrice: 11 }],
        },
      })
    ).status,
    201,
  );
  assert.equal((await req(`documents/${mismatch.value.id}/apply`, apply)).status, 409);
});
test('documentos: factura solo vincula soporte y obra cerrada bloquea escritura', async () => {
  const f = await uploadTestDocument('Factura');
  assert.equal(
    (
      await req(`documents/${f.value.id}/review`, {
        expectedRevision: 0,
        confirmed: true,
        review: { ...reviewedDoc, kind: 'INVOICE', folio: 'FACT-1' },
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await req(`documents/${f.value.id}/apply`, {
        expectedRevision: 1,
        confirmed: true,
        orderId: docOrder,
      })
    ).status,
    201,
  );
  assert.equal(await db.payment.count({ where: { orderId: docOrder } }), 0);
  assert.equal(await db.movement.count({ where: { projectId: docProject } }), 1);
  assert.equal((await uploadTestDocument('No escribir', changeProject)).status, 409);
});

let expProject = '',
  expBudget = '',
  expFamily = '',
  expMove = 'not-created-yet',
  expRecord = '';
const expDay = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
const expBody = () => ({
  projectId: expProject,
  budgetItemId: expBudget,
  familyId: expFamily,
  reference: 'EXP-REF-1',
  front: 'Frente A',
  startDate: expDay,
  endDate: expDay,
  quantity: 10,
  isTest: false,
  coverage: 'DIRECT_COMPLETE',
  laborCost: 60,
  equipmentCost: 0,
  otherCost: 0,
  laborHours: 5,
  costReference: 'Reporte de horas ficticio de pruebas',
  note: 'Prueba aislada',
  confirmed: true,
  allocations: [{ movementId: expMove, quantity: 4 }],
});
test('experiencia: prepara fuentes reales de prueba, exige línea base y unidades comparables', async () => {
  expProject = (
    await req('projects', {
      code: 'EXP-TEST',
      name: 'Experiencia test',
      client: 'Test',
      location: 'Local',
      manager: 'Test',
      startDate: '2020-01-01',
      endDate: '2030-12-31',
    })
  ).value.id;
  expBudget = (
    await req('budget', {
      projectId: expProject,
      code: 'EXP-C1',
      name: 'Trabajo comparable',
      unit: 'm2',
      quantity: 100,
      components: [{ name: 'Costo directo', quantity: 1, price: 10 }],
    })
  ).value.id;
  expFamily = (
    await req('experience/families', {
      code: 'MURO',
      name: 'Muro comparable',
      unit: 'm2',
      version: '1',
      method: 'Método test',
      conditions: 'Acceso libre',
    })
  ).value.id;
  assert.equal((await req('experience/records', expBody())).status, 409);
  await req(`projects/${expProject}/approve-budget`, {});
  const order = (
    await req('orders', {
      projectId: expProject,
      supplier: 'Test',
      expectedDate: expDay,
      lines: [{ materialId, quantity: 20, unitPrice: 10 }],
    })
  ).value;
  await req(`orders/${order.id}/approve`, {});
  await req(`orders/${order.id}/receive`, {
    lineId: order.lines[0].id,
    quantity: 20,
    reference: 'REC-EXP',
  });
  expMove = (
    await req('stock/consume', {
      projectId: expProject,
      materialId,
      quantity: 20,
      reference: 'Consumo EXP',
    })
  ).value.id;
  const other = (
    await req('experience/families', {
      code: 'OTRO',
      name: 'Otra unidad',
      unit: 'm3',
      version: '1',
      method: 'Distinto',
      conditions: 'Distintas',
    })
  ).value;
  assert.equal((await req('experience/records', { ...expBody(), familyId: other.id })).status, 400);
  assert.equal(
    (
      await req('experience/records', {
        ...expBody(),
        budgetItemId: (await db.budgetItem.findFirst({ where: { projectId } }))!.id,
      })
    ).status,
    400,
  );
  const incoming = await db.movement.findFirstOrThrow({
    where: { projectId: expProject, type: 'IN' },
  });
  assert.equal(
    (
      await req('experience/records', {
        ...expBody(),
        allocations: [{ movementId: incoming.id, quantity: 1 }],
      })
    ).status,
    400,
  );
});
test('experiencia: registro idempotente guarda costo de salida y versión de presupuesto sin mover almacén', async () => {
  const key = randomUUID(),
    body = expBody();
  const [a, b] = await Promise.all([
    req('experience/records', body, key),
    req('experience/records', body, key),
  ]);
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);
  expRecord = a.value.id;
  assert.equal(b.value.id, expRecord);
  assert.equal(a.value.metrics.recordedCost, '100.00');
  assert.equal(a.value.plannedUnitPrice, '10');
  assert.equal(a.value.budgetSnapshot.name, 'Trabajo comparable');
  assert.equal(a.value.budgetHash.length, 64);
  assert.equal(await db.movement.count({ where: { projectId: expProject } }), 2);
  assert.equal(
    (
      await db.stock.findUniqueOrThrow({
        where: { projectId_materialId: { projectId: expProject, materialId } },
      })
    ).quantity.toString(),
    '0',
  );
  const d = (await req('data')).value.experience;
  assert.equal(d.groups.length, 0);
  assert.equal(d.movements.find((m: any) => m.id === expMove).available, '16.0000');
  assert.equal(
    (await req('experience/records', { ...body, reference: 'EXP-REF-2', front: ' FRENTE  A ' }))
      .status,
    409,
  );
});
test('experiencia: validar incluye muestra real con fuentes; prueba no se valida', async () => {
  assert.equal(
    (
      await req(`experience/records/${expRecord}/actions`, {
        action: 'VALIDATE',
        expectedRevision: 0,
        note: 'Verificado método y fuentes',
        confirmed: true,
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await req(`experience/records/${expRecord}/actions`, {
        action: 'WITHDRAW',
        expectedRevision: 0,
        note: 'Viejo',
        confirmed: true,
      })
    ).status,
    409,
  );
  const testRecord = await req('experience/records', {
    ...expBody(),
    isTest: true,
    reference: 'TEST-EXCLUDED',
    allocations: [{ movementId: expMove, quantity: 1 }],
  });
  assert.equal(testRecord.status, 201);
  assert.equal(
    (
      await req(`experience/records/${testRecord.value.id}/actions`, {
        action: 'VALIDATE',
        expectedRevision: 0,
        note: 'No debe',
        confirmed: true,
      })
    ).status,
    409,
  );
  const d = (await req('data')).value.experience;
  assert.equal(d.groups[0].sampleCount, 1);
  assert.deepEqual(d.groups[0].sourceIds, [expRecord]);
  assert.equal(d.byProject[expProject][0].unitCost, '10.0000');
  assert.equal(d.byProject[docProject].length, 0);
});
test('experiencia: asignaciones concurrentes no rebasan salida y anular libera sin devolver inventario', async () => {
  const results = await Promise.all(
    ['B', 'C'].map((front) =>
      req('experience/records', {
        ...expBody(),
        reference: 'RACE-' + front,
        front,
        allocations: [{ movementId: expMove, quantity: 10 }],
      }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  const id = results.find((r) => r.status === 201)!.value.id;
  assert.equal(
    (
      await req(`experience/records/${id}/actions`, {
        action: 'VOID',
        expectedRevision: 0,
        note: 'Corregir atribución',
        confirmed: true,
      })
    ).status,
    201,
  );
  const d = (await req('data')).value.experience;
  assert.equal(d.movements.find((m: any) => m.id === expMove).available, '15.0000');
  assert.equal(await db.movement.count({ where: { projectId: expProject } }), 2);
  assert.equal(
    (
      await req(`experience/records/${expRecord}/actions`, {
        action: 'WITHDRAW',
        expectedRevision: 1,
        note: 'Retirar para revisión',
        confirmed: true,
      })
    ).status,
    201,
  );
  assert.equal((await req('data')).value.experience.groups.length, 0);
  assert.equal(
    (
      await req(`experience/records/${expRecord}/actions`, {
        action: 'VOID',
        expectedRevision: 2,
        note: 'Corregir cantidad',
        confirmed: true,
      })
    ).status,
    201,
  );
  assert.equal(
    (await req('data')).value.experience.movements.find((m: any) => m.id === expMove).available,
    '19.0000',
  );
  assert.equal(await db.experienceEvent.count({ where: { recordId: expRecord } }), 4);
  assert.equal(
    (await req('experience/records', { ...expBody(), projectId: changeProject })).status,
    409,
  );
});

test('predicción: requiere sesión, valida obra/material y no escribe inventario ni órdenes', async () => {
  const body = { projectId: expProject, materialId, horizon: 14, leadDays: 5, safetyDays: 2 };
  assert.equal((await req('supply/forecast', body, undefined, false)).status, 401);
  assert.equal((await req('supply/forecast', { ...body, projectId: 'missing' })).status, 404);
  assert.equal((await req('supply/forecast', { ...body, materialId: 'missing' })).status, 400);
  assert.equal((await req('supply/forecast', { ...body, horizon: 91 })).status, 400);
  const before = await Promise.all([
    db.movement.count(),
    db.purchaseOrder.count(),
    db.stockTransfer.count(),
    db.command.count(),
  ]);
  const response = await req('supply/forecast', body);
  assert.equal(response.status, 201);
  assert.equal(response.value.projectId, expProject);
  assert.equal(response.value.daily.length, 14);
  assert.equal(response.value.history.sufficient, false);
  assert.deepEqual(
    await Promise.all([
      db.movement.count(),
      db.purchaseOrder.count(),
      db.stockTransfer.count(),
      db.command.count(),
    ]),
    before,
  );
});
test('predicción: comparación revalida sobrantes y conserva recomendaciones separadas de compromisos', async () => {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
  const response = await req('supply/forecast', {
    projectId: expProject,
    materialId,
    horizon: 14,
    leadDays: 5,
    safetyDays: 0,
    comparison: {
      quantity: 10,
      neededOn: today,
      options: [
        {
          kind: 'BUY',
          label: 'Compra de prueba',
          unitPrice: 10,
          freight: 50,
          arrival: today,
          confirmed: true,
          reference: 'SIMULACION',
        },
        {
          kind: 'TRANSFER',
          label: 'Origen sin sobrante',
          fromProjectId: expProject,
          unitPrice: 0,
          freight: 0,
          arrival: today,
          confirmed: true,
          reference: 'SIMULACION',
        },
      ],
    },
  });
  assert.equal(response.status, 201);
  assert.equal(response.value.comparison.recommendedIndex, 0);
  assert.equal(response.value.comparison.options[0].total, '150.00');
  assert.equal(response.value.comparison.options[1].eligible, false);
});

let teamUser: any,
  adminCookie = '',
  residentCookie = '';
const teamTemp = 'Temporary-access-test-2026!',
  teamFinal = 'Changed-access-test-2026!';
async function teamLogin(email: string, password: string) {
  const r = await fetch(base + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return {
    status: r.status,
    cookie: r.headers.get('set-cookie')?.split(';')[0] || '',
    value: await r.json(),
  };
}
test('equipo: administración crea cuenta idempotente sin exponer credenciales y exige cambio inicial', async () => {
  adminCookie = cookie;
  const body = {
      name: 'Residente limitado',
      email: 'resident@obra.test',
      role: 'RESIDENT',
      projectIds: [expProject],
      password: teamTemp,
    },
    key = randomUUID();
  const a = await req('users', body, key),
    b = await req('users', body, key);
  assert.equal(a.status, 201);
  assert.equal(a.value.id, b.value.id);
  teamUser = a.value;
  assert.equal('passwordHash' in a.value, false);
  assert.equal('password' in a.value, false);
  assert.equal(
    (await req('users', { ...body, email: 'bad@obra.test', projectIds: ['missing'] })).status,
    400,
  );
  const login = await teamLogin(body.email, teamTemp);
  assert.equal(login.status, 201);
  cookie = login.cookie;
  assert.equal((await req('data')).value.code, 'PASSWORD_CHANGE_REQUIRED');
  assert.equal((await req('logs', { projectId: expProject })).status, 403);
  assert.equal(
    (await req('auth/password', { currentPassword: 'incorrecta', password: teamFinal })).status,
    400,
  );
  assert.equal(
    (await req('auth/password', { currentPassword: teamTemp, password: 'corta' })).status,
    400,
  );
  assert.equal(
    (await req('auth/password', { currentPassword: teamTemp, password: teamFinal })).status,
    201,
  );
  assert.equal((await req('data')).status, 401);
  residentCookie = (await teamLogin(body.email, teamFinal)).cookie;
  cookie = residentCookie;
  const d = (await req('data')).value;
  assert.deepEqual(
    d.projects.map((p: any) => p.id),
    [expProject],
  );
  assert.equal(d.audits.length, 0);
  assert.equal('passwordHash' in d.user, false);
  assert.equal('memberships' in d.user, false);
  for (const key of [
    'orders',
    'stocks',
    'movements',
    'logs',
    'needs',
    'drawings',
    'changes',
    'documents',
  ])
    assert.ok(
      d[key].every((r: any) => r.projectId === expProject),
      key,
    );
  assert.ok(d.experience.records.every((r: any) => r.projectId === expProject));
  assert.equal((await req('users')).status, 403);
  assert.equal(
    (await req('users', { ...body, email: 'escalate@obra.test', role: 'ADMIN' })).status,
    403,
  );
  cookie = adminCookie;
});
test('equipo: obra y rol se verifican también por ID y descargas privadas', async () => {
  cookie = residentCookie;
  assert.equal(
    (
      await req('logs', {
        projectId: expProject,
        date: expDay,
        title: 'Registro autorizado',
        activities: 'Trabajo de prueba',
        crew: 1,
        weather: 'Sol',
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await req('logs', {
        projectId: projectId,
        date: expDay,
        title: 'No autorizado',
        activities: 'No',
        crew: 1,
        weather: 'Sol',
      })
    ).status,
    403,
  );
  assert.equal((await req(`orders/${orderId}/approve`, {})).status, 403);
  assert.equal((await req(`orders/${orderId}/pay`, { amount: 1 })).status, 403);
  for (const path of [
    `documents/${docId}/file`,
    `drawings/${drawingId}/versions/${planVersionId}/file`,
    `plan-issues/${planIssueId}/evidence/missing`,
    `logs/${evidenceLog}/attachments/${evidenceId}`,
  ])
    assert.equal((await req(path)).status, 403, path);
  assert.equal((await req(`changes/${changeId}/actions`, { action: 'APPROVE' })).status, 403);
  const f = await req('supply/forecast', {
    projectId: expProject,
    materialId,
    horizon: 7,
    leadDays: 1,
    safetyDays: 0,
  });
  assert.equal(f.status, 201);
  assert.equal(f.value.alternatives.length, 0);
  assert.ok(
    f.value.suppliers.flatMap((s: any) => s.sources).every((o: any) => o.projectId === expProject),
  );
  assert.equal(
    (
      await req('supply/forecast', {
        projectId,
        materialId,
        horizon: 7,
        leadDays: 1,
        safetyDays: 0,
      })
    ).status,
    403,
  );
  cookie = adminCookie;
});
test('equipo: consulta no escribe, acceso vacío no filtra obras, y traspasos requieren ambos extremos', async () => {
  for (const role of ['VIEWER', 'WAREHOUSE', 'PURCHASING', 'FINANCE']) {
    const u = await db.user.create({
      data: {
        name: role,
        email: role.toLowerCase() + '@obra.test',
        role,
        mustChangePassword: false,
        passwordHash: hashPassword(teamFinal),
        memberships: { create: role === 'VIEWER' ? [] : [{ projectId: expProject }] },
      },
    });
    cookie = (await teamLogin(u.email, teamFinal)).cookie;
    const data = (await req('data')).value;
    assert.equal(data.projects.length, role === 'VIEWER' ? 0 : 1);
    if (role === 'VIEWER') {
      assert.equal(data.experience.records.length, 0);
      assert.equal(data.experience.movements.length, 0);
      assert.equal(data.transfers.length, 0);
      assert.equal(
        (
          await req('materials', {
            code: 'NO',
            name: 'No',
            unit: 'pza',
            price: 1,
            type: 'MATERIAL',
          })
        ).status,
        403,
      );
      assert.equal((await req('supply/needs', { projectId: expProject })).status, 403);
    }
    if (role === 'WAREHOUSE') {
      assert.equal(
        (
          await req('stock/transfers', {
            fromProjectId: expProject,
            toProjectId: destination,
            materialId,
            quantity: 1,
            reference: 'No acceso al destino',
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await req('stock/transfers', {
            fromProjectId: origin,
            toProjectId: expProject,
            materialId,
            quantity: 1,
            reference: 'No acceso al origen',
          })
        ).status,
        403,
      );
      assert.equal((await req('orders', { projectId: expProject })).status, 403);
    }
    if (role === 'PURCHASING') {
      assert.equal(
        (
          await req('orders', {
            projectId: expProject,
            supplier: 'Permitido',
            expectedDate: expDay,
            lines: [{ materialId, quantity: 1, unitPrice: 10 }],
          })
        ).status,
        201,
      );
      assert.equal(
        (
          await req('stock/consume', {
            projectId: expProject,
            materialId,
            quantity: 1,
            reference: 'No permitido',
          })
        ).status,
        403,
      );
    }
    if (role === 'FINANCE') {
      assert.equal((await req('orders', { projectId: expProject })).status, 403);
      assert.equal((await req(`orders/${orderId}/pay`, { amount: 1 })).status, 403);
    }
  }
  cookie = adminCookie;
});
test('equipo: documentos no permiten saltar la separación de compras y almacén', async () => {
  const purchase = await db.user.findFirstOrThrow({ where: { role: 'PURCHASING' } });
  await db.projectMember.create({ data: { userId: purchase.id, projectId: docProject } });
  cookie = (await teamLogin(purchase.email, teamFinal)).cookie;
  const delivery = await db.sourceDocument.findFirstOrThrow({
    where: { projectId: docProject, reviewed: { path: ['kind'], equals: 'DELIVERY' } },
  });
  assert.equal(
    (
      await req(`documents/${delivery.id}/apply`, {
        expectedRevision: delivery.revision,
        confirmed: true,
      })
    ).status,
    403,
  );
  cookie = adminCookie;
});
test('equipo: cambiar permisos revoca sesiones, bloquea revisiones antiguas y protege al administrador', async () => {
  const current = await db.user.findUniqueOrThrow({ where: { id: teamUser.id } });
  const body = {
    name: current.name,
    email: current.email,
    role: 'VIEWER',
    active: true,
    projectIds: [],
    expectedRevision: current.revision,
    reason: 'Retirar acceso para prueba',
  };
  assert.equal((await req(`users/${current.id}`, body)).status, 201);
  cookie = residentCookie;
  assert.equal((await req('data')).status, 401);
  cookie = adminCookie;
  assert.equal((await req(`users/${current.id}`, body)).status, 409);
  const own = (await req('data')).value.user;
  assert.equal(
    (
      await req(`users/${own.id}`, {
        name: own.name,
        email: own.email,
        role: 'VIEWER',
        active: true,
        projectIds: [],
        expectedRevision: own.revision,
        reason: 'Intento de retirar administrador',
      })
    ).status,
    409,
  );
  const fresh = await db.user.findUniqueOrThrow({ where: { id: current.id } });
  assert.equal(
    (await req(`users/${fresh.id}`, { ...body, expectedRevision: fresh.revision, active: false }))
      .status,
    201,
  );
  assert.equal((await teamLogin(current.email, teamFinal)).status, 401);
});
test('equipo: renovar contraseña revoca sesiones y no almacena secretos en auditoría o resultados', async () => {
  const u = await db.user.findFirstOrThrow({ where: { role: 'PURCHASING' } }),
    oldSession = (await teamLogin(u.email, teamFinal)).cookie;
  assert.equal(
    (
      await req(`users/${u.id}/password`, {
        password: teamTemp,
        expectedRevision: u.revision,
        reason: 'Prueba de recuperación',
      })
    ).status,
    201,
  );
  cookie = oldSession;
  assert.equal((await req('data')).status, 401);
  cookie = (await teamLogin(u.email, teamTemp)).cookie;
  assert.equal((await req('data')).value.code, 'PASSWORD_CHANGE_REQUIRED');
  cookie = adminCookie;
  const dump =
    JSON.stringify(await db.command.findMany()) +
    JSON.stringify(await db.audit.findMany()) +
    JSON.stringify((await req('users')).value);
  assert.equal(dump.includes(teamTemp), false);
  assert.equal(dump.includes(teamFinal), false);
  assert.equal(dump.includes('passwordHash'), false);
});

test('expediente PDF respeta fechas, cierre y permisos sin modificar registros', async () => {
  const viewer = await db.user.findFirstOrThrow({ where: { email: 'viewer@obra.test' } });
  await db.projectMember.create({ data: { userId: viewer.id, projectId: expProject } });
  const draft = await db.siteLog.create({
    data: {
      projectId: expProject,
      date: new Date('2026-10-18'),
      title: 'Expediente de prueba',
      activities: 'Texto completo para entrega al cliente',
      author: 'Test',
      crew: 2,
      weather: 'Sol',
    },
  });
  const viewerSession = (await teamLogin(viewer.email, teamFinal)).cookie;
  const exportPdf = (body: any, session = viewerSession) =>
    fetch(base + '/logs/export', {
      method: 'POST',
      headers: { Cookie: session, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  const selection = {
    projectId: expProject,
    from: '2026-10-18',
    to: '2026-10-18',
    includePhotos: true,
  };
  const empty = await exportPdf(selection);
  assert.equal(empty.status, 400);
  const response = await exportPdf({ ...selection, includeDrafts: true });
  assert.equal(response.status, 201);
  assert.match(response.headers.get('content-type')!, /application\/pdf/);
  assert.match(response.headers.get('cache-control')!, /no-store/);
  const doc = await PDFDocument.load(await response.arrayBuffer());
  assert.ok(doc.getPageCount() >= 4);
  assert.equal((await db.siteLog.findUniqueOrThrow({ where: { id: draft.id } })).status, 'DRAFT');
  const direct = await fetch(base + `/logs/${draft.id}/pdf`, {
    headers: { Cookie: viewerSession },
  });
  assert.equal(direct.status, 200);
  await direct.arrayBuffer();
  assert.equal((await exportPdf({ ...selection, projectId, includeDrafts: true })).status, 403);
  assert.equal(
    (await fetch(base + `/logs/${logId}/pdf`, { headers: { Cookie: viewerSession } })).status,
    403,
  );
  assert.equal((await exportPdf({ ...selection, includeDrafts: true }, '')).status, 401);
});

test('logout revoca la sesión en el servidor', async () => {
  assert.equal((await req('auth/logout', {})).status, 201);
  assert.equal((await req('data')).status, 401);
});
