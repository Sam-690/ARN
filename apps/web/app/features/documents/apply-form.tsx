'use client';
import { FormEvent, useState } from 'react';
import { useCan } from '../../access';
import type { Data, SourceDocument } from '../../types';
import { Field, kinds, money, Save } from './helpers';
export function ApplyForm({
  doc,
  data,
  busy,
  save,
}: {
  doc: SourceDocument;
  data: Data;
  busy: boolean;
  save: Save;
}) {
  const can = useCan();
  const r = doc.reviewed!,
    [orderId, setOrderId] = useState(''),
    [confirmed, setConfirmed] = useState(false),
    [correct, setCorrect] = useState(false);
  const orders = data.orders.filter(
      (o) =>
        o.projectId === doc.projectId &&
        (r.kind === 'DELIVERY'
          ? ['APPROVED', 'PARTIAL'].includes(o.status)
          : o.status !== 'CANCELLED'),
    ),
    order = orders.find((o) => o.id === orderId);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    await save(
      `documents/${doc.id}/apply`,
      {
        expectedRevision: doc.revision,
        confirmed,
        ...(r.kind === 'QUOTE' ? { expectedDate: f.expectedDate } : { orderId }),
        ...(r.kind === 'DELIVERY' ? { lineIds: r.lines.map((_, i) => f['line' + i]) } : {}),
      },
      r.kind === 'DELIVERY'
        ? 'Remisión aplicada al almacén'
        : r.kind === 'QUOTE'
          ? 'Compra creada en borrador'
          : 'Factura vinculada como soporte',
    );
  }
  return (
    <>
      <h3>
        {kinds[r.kind]} revisada · {r.folio}
      </h3>
      <p>
        {r.supplier} · {r.date} · {r.currency}
      </p>
      <div className="document-notice">
        <p>
          Subtotal registrado: {r.subtotal === null ? 'No indicado' : money(r.subtotal)} ·
          Impuestos: {r.tax === null ? 'No indicados' : money(r.tax)} · Total:{' '}
          {r.total === null ? 'No indicado' : money(r.total)}
        </p>
        <p>Revisión: {r.note}</p>
      </div>
      <div className="document-lines-summary">
        {r.lines.map((l, i) => (
          <p key={i}>
            {l.quantity} {l.unit} · {l.description} · {money(l.unitPrice)} / {l.unit}
          </p>
        ))}
      </div>
      {doc.status === 'APPLIED' ? (
        <div className="document-notice">
          <strong>
            Aplicado a OC-{data.orders.find((o) => o.id === doc.orderId)?.number || '—'}
          </strong>
          <p>El documento aplicado conserva sus datos e historial.</p>
        </div>
      ) : (
        <>
          <form onSubmit={submit}>
            <fieldset disabled={busy}>
              <h3>
                {r.kind === 'QUOTE'
                  ? 'Crear compra en borrador'
                  : r.kind === 'DELIVERY'
                    ? 'Comparar y recibir material'
                    : 'Vincular factura a compra'}
              </h3>
              {r.kind === 'QUOTE' ? (
                <Field label="Entrega esperada">
                  <input type="date" name="expectedDate" required />
                </Field>
              ) : (
                <Field label="Compra de esta obra">
                  <select
                    required
                    value={orderId}
                    onChange={(e) => {
                      setOrderId(e.target.value);
                      setConfirmed(false);
                    }}
                  >
                    <option value="">Selecciona una compra</option>
                    {orders.map((o) => (
                      <option key={o.id} value={o.id}>
                        OC-{o.number} · {o.supplier}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {r.kind === 'DELIVERY' &&
                r.lines.map((l, i) => (
                  <Field
                    key={orderId + ':' + i}
                    label={`${l.description}: ${l.quantity} ${l.unit} a ${money(l.unitPrice)}`}
                  >
                    <select required name={'line' + i} defaultValue="">
                      <option value="">Relaciona la partida de la orden</option>
                      {order?.lines
                        .filter((ol) => ol.materialId === l.materialId)
                        .map((ol) => (
                          <option value={ol.id} key={ol.id}>
                            {ol.material.name} · pendiente{' '}
                            {Number(ol.quantity) - Number(ol.received)} {ol.material.unit} ·{' '}
                            {money(ol.unitPrice)}
                          </option>
                        ))}
                    </select>
                  </Field>
                ))}
              <p className="document-notice">
                {r.kind === 'QUOTE'
                  ? 'Se creará una orden sin aprobar, con precios netos. Los impuestos del documento no se agregan a la orden.'
                  : r.kind === 'DELIVERY'
                    ? 'Al confirmar aumentará el inventario y se descontarán las cantidades pendientes. Los precios deben coincidir con la compra.'
                    : 'Se vinculará el original como soporte. No valida fiscalmente la factura, no registra una recepción ni genera pagos.'}
              </p>
              <label className="document-confirm">
                <input
                  type="checkbox"
                  required
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                Confirmo los datos y esta operación.
              </label>
              <button
                className="primary"
                disabled={
                  !confirmed ||
                  (doc.reviewed?.kind === 'QUOTE'
                    ? !can('orders')
                    : doc.reviewed?.kind === 'DELIVERY'
                      ? !can('stock')
                      : false)
                }
              >
                Confirmar{' '}
                {r.kind === 'QUOTE'
                  ? 'creación de compra'
                  : r.kind === 'DELIVERY'
                    ? 'recepción'
                    : 'vinculación'}
              </button>
            </fieldset>
          </form>
          <button className="text-button" disabled={busy} onClick={() => setCorrect(!correct)}>
            Corregir revisión antes de aplicar
          </button>
          {correct && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                await save(
                  `documents/${doc.id}/reopen`,
                  { expectedRevision: doc.revision, note: f.get('note') },
                  'Revisión abierta para corrección',
                );
              }}
            >
              <Field label="Motivo de corrección">
                <input name="note" required maxLength={200} />
              </Field>
              <button className="secondary" disabled={busy}>
                Abrir corrección
              </button>
            </form>
          )}
        </>
      )}
    </>
  );
}
