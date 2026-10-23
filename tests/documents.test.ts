import test from 'node:test';
import assert from 'node:assert/strict';
import {
  documentIdentity,
  documentReview,
  checkDocumentTotals,
  extractDocument,
  decodeDocument,
} from '../apps/api/src/documents';
const review = {
  kind: 'QUOTE' as const,
  supplier: 'Proveedor',
  folio: 'F-1',
  date: '2026-10-15',
  currency: 'MXN' as const,
  note: 'Cotejado',
  subtotal: 20,
  tax: 3.2,
  total: 23.2,
  lines: [{ description: 'Material', unit: 'pza', materialId: 'm', quantity: 2, unitPrice: 10 }],
};
test('identidad documental normaliza espacios y mayúsculas pero distingue tipo', () => {
  assert.equal(
    documentIdentity(review),
    documentIdentity({ ...review, supplier: ' PROVEEDOR ', folio: 'f-1' }),
  );
  assert.notEqual(documentIdentity(review), documentIdentity({ ...review, kind: 'INVOICE' }));
});
test('revisión valida decimales, fechas, moneda y totales con redondeo decimal', () => {
  assert.equal(checkDocumentTotals(documentReview.parse(review)).toString(), '20');
  assert.throws(() => checkDocumentTotals({ ...review, subtotal: 19 }));
  assert.throws(() => checkDocumentTotals({ ...review, total: 22 }));
  assert.throws(() => documentReview.parse({ ...review, currency: 'USD' }));
  assert.throws(() => documentReview.parse({ ...review, date: '2026-02-31' }));
  assert.throws(() =>
    documentReview.parse({ ...review, lines: [{ ...review.lines[0], quantity: 1.00001 }] }),
  );
  assert.equal(
    checkDocumentTotals({
      ...review,
      subtotal: 0.3,
      tax: null,
      total: null,
      lines: [{ ...review.lines[0], quantity: 3, unitPrice: 0.1 }],
    }).toString(),
    '.3'.replace(/^\./, '0.'),
  );
});
test('rechaza archivos falsos y audio en documentos', async () => {
  await assert.rejects(() =>
    decodeDocument({
      projectId: 'p',
      name: 'a.pdf',
      mime: 'application/pdf',
      base64: Buffer.from('no pdf').toString('base64'),
    }),
  );
  await assert.rejects(() =>
    decodeDocument({
      projectId: 'p',
      name: 'a.png',
      mime: 'image/png',
      base64: Buffer.from('no image').toString('base64'),
    }),
  );
});
test('extracción envía archivo y estructura, conserva dudas y rechaza respuestas incompletas', async () => {
  const result = {
    kind: 'UNKNOWN',
    supplier: null,
    folio: null,
    date: null,
    currency: null,
    subtotal: null,
    tax: null,
    total: null,
    lines: [],
    warnings: ['Ilegible'],
  };
  let sent: any;
  const fetcher = (async (_url: any, opts: any) => {
    sent = JSON.parse(opts.body);
    return new Response(
      JSON.stringify({
        status: 'completed',
        output: [
          { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(result) }] },
        ],
      }),
    );
  }) as typeof fetch;
  assert.deepEqual(
    await extractDocument(
      { content: Buffer.from('fake'), mime: 'application/pdf', name: 'doc.pdf' },
      'test',
      'configured-model',
      fetcher,
    ),
    result,
  );
  assert.equal(sent.store, false);
  assert.equal(sent.text.format.strict, true);
  assert.match(sent.input[0].content[0].file_data, /^data:application\/pdf;base64,/);
  assert.equal(sent.model, 'configured-model');
  await assert.rejects(() =>
    extractDocument(
      { content: Buffer.from('fake'), mime: 'image/png', name: 'd.png' },
      'test',
      'model',
      (async () => new Response(JSON.stringify({ status: 'incomplete' }))) as typeof fetch,
    ),
  );
});
