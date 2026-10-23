import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { createLogReport, logExportSchema } from '../apps/api/src/log-report';
import { reportLogs, reportProject } from './fixtures/log-report';
test('expediente pagina textos extensos e incluye evidencia sin alterar los registros', async () => {
  const logs = await reportLogs(),
    before = logs[0].activities;
  const bytes = await createLogReport(reportProject, logs, {
    includePhotos: true,
    author: 'Prueba',
  });
  const doc = await PDFDocument.load(bytes);
  assert.ok(doc.getPageCount() >= 6);
  assert.equal(doc.getTitle(), 'Expediente de bitácoras - ' + reportProject.name);
  assert.equal(logs[0].activities, before);
  for (const page of doc.getPages()) {
    assert.equal(page.getWidth(), 595.28);
    assert.equal(page.getHeight(), 841.89);
  }
});
test('expediente rechaza fotos dañadas y permite excluirlas explícitamente', async () => {
  const logs = await reportLogs();
  logs[0].attachments[0].content = Buffer.from('dañada');
  await assert.rejects(
    () => createLogReport(reportProject, logs, { includePhotos: true, author: 'Test' }),
    /No se pudo procesar la foto/,
  );
  assert.ok(
    (await createLogReport(reportProject, logs, { includePhotos: false, author: 'Test' })).length >
      1000,
  );
});
test('expediente valida periodo, selección vacía y límite de registros', async () => {
  assert.equal(
    logExportSchema.safeParse({ projectId: '1', from: '2026-02-30', to: '2026-03-01' }).success,
    false,
  );
  assert.equal(
    logExportSchema.safeParse({ projectId: '1', from: '2026-03-01', to: '2026-02-01' }).success,
    false,
  );
  const v = logExportSchema.parse({ projectId: '1', from: '2026-03-01', to: '2026-03-02' });
  assert.equal(v.includeDrafts, false);
  assert.equal(v.includePhotos, true);
  await assert.rejects(
    () => createLogReport(reportProject, [], { includePhotos: true, author: 'Test' }),
    /No hay/,
  );
  const [log] = await reportLogs();
  await assert.rejects(
    () =>
      createLogReport(reportProject, Array(31).fill(log), { includePhotos: true, author: 'Test' }),
    /hasta 30/,
  );
});
