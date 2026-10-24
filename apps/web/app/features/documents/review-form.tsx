'use client';
import { Check, Plus, Trash2 } from 'lucide-react';
import { FormEvent, useState } from 'react';
import type { Data, SourceDocument } from '../../types';
import { blankLine, Field, kinds, money, Save } from './helpers';
export function ReviewForm({
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
  const source = doc.reviewed || doc.extracted;
  const [lines, setLines] = useState(() =>
    source?.lines.length
      ? source.lines.map((l) => ({
          ...l,
          description: l.description || '',
          unit: l.unit || '',
          quantity: l.quantity || 0,
          unitPrice: l.unitPrice || 0,
          materialId: 'materialId' in l ? String(l.materialId) : '',
        }))
      : [blankLine()],
  );
  const [confirmed, setConfirmed] = useState(false);
  const materials = data.materials.filter((m) => m.type === 'MATERIAL');
  const subtotal = lines.reduce((s, l) => s + Math.round(l.quantity * l.unitPrice * 100) / 100, 0);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)),
      amount = (k: string) => (f[k] === '' ? null : Number(f[k]));
    await save(
      `documents/${doc.id}/review`,
      {
        expectedRevision: doc.revision,
        confirmed,
        review: {
          kind: f.kind,
          supplier: f.supplier,
          folio: f.folio,
          date: f.date,
          currency: f.currency,
          note: f.note,
          subtotal: amount('subtotal'),
          tax: amount('tax'),
          total: amount('total'),
          lines,
        },
      },
      'Documento revisado. Elige cómo aplicarlo.',
    );
  }
  return (
    <form onSubmit={submit}>
      <fieldset disabled={busy}>
        <h3>Revisar datos y equivalencias</h3>
        <p className="document-notice">
          Todos los campos requieren revisión contra el original. Una coincidencia de nombre no
          confirma el material ni su unidad.
        </p>
        {doc.extracted?.warnings?.map((w, i) => (
          <p className="document-warning" key={i}>
            {w}
          </p>
        ))}
        <div className="form-grid">
          <Field label="Tipo de documento">
            <select
              name="kind"
              required
              defaultValue={
                source && ['QUOTE', 'DELIVERY', 'INVOICE'].includes(source.kind) ? source.kind : ''
              }
            >
              <option value="">Selecciona el tipo</option>
              {Object.entries(kinds).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Proveedor">
            <input name="supplier" required maxLength={200} defaultValue={source?.supplier || ''} />
          </Field>
          <Field label="Folio del proveedor">
            <input name="folio" required maxLength={200} defaultValue={source?.folio || ''} />
          </Field>
          <Field label="Fecha del documento">
            <input name="date" type="date" required defaultValue={source?.date || ''} />
          </Field>
          <Field label="Moneda del original">
            <input
              name="currency"
              required
              pattern="MXN"
              title="Esta versión admite documentos en MXN"
              maxLength={16}
              defaultValue={source?.currency || ''}
              placeholder="MXN"
            />
          </Field>
        </div>
        {lines.map((l, i) => {
          const selected = materials.find((m) => m.id === l.materialId),
            matches = materials.filter((m) => m.name.toLowerCase() === l.description.toLowerCase());
          return (
            <div className="document-line" key={i}>
              <div className="panel-head">
                <h3>Partida {i + 1}</h3>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Quitar partida ${i + 1}`}
                  disabled={lines.length === 1}
                  onClick={() => setLines(lines.filter((_, n) => n !== i))}
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <Field label="Descripción del documento">
                <input
                  required
                  maxLength={200}
                  value={l.description}
                  onChange={(e) =>
                    setLines(
                      lines.map((x, n) => (n === i ? { ...x, description: e.target.value } : x)),
                    )
                  }
                />
              </Field>
              <Field label="Material del catálogo">
                <select
                  required
                  value={l.materialId}
                  onChange={(e) =>
                    setLines(
                      lines.map((x, n) => (n === i ? { ...x, materialId: e.target.value } : x)),
                    )
                  }
                >
                  <option value="">Selecciona y verifica el material</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.code} · {m.name} ({m.unit})
                    </option>
                  ))}
                </select>
              </Field>
              {!selected && matches.length === 1 && (
                <p className="small-note">
                  Coincidencia de nombre: {matches[0].code}. Selecciónala solo si corresponde.
                </p>
              )}
              <div className="form-grid">
                {(['unit', 'quantity', 'unitPrice'] as const).map((k) => (
                  <Field
                    key={k}
                    label={
                      k === 'unit'
                        ? 'Unidad revisada'
                        : k === 'quantity'
                          ? 'Cantidad revisada'
                          : 'Precio unitario neto (MXN)'
                    }
                  >
                    <input
                      required
                      type={k === 'unit' ? 'text' : 'number'}
                      min={k === 'unit' ? undefined : '.0001'}
                      max={k === 'unit' ? undefined : '100000000'}
                      step=".0001"
                      value={l[k] || ''}
                      onChange={(e) =>
                        setLines(
                          lines.map((x, n) =>
                            n === i
                              ? {
                                  ...x,
                                  [k]: k === 'unit' ? e.target.value : Number(e.target.value),
                                }
                              : x,
                          ),
                        )
                      }
                    />
                  </Field>
                ))}
              </div>
              {selected && (
                <p
                  className={
                    l.unit.trim().toLowerCase() === selected.unit.trim().toLowerCase()
                      ? 'small-note'
                      : 'document-warning'
                  }
                >
                  Unidad de catálogo: <strong>{selected.unit}</strong> · Precio de referencia:{' '}
                  {money(selected.price)}.{' '}
                  {l.unit.trim().toLowerCase() !== selected.unit.trim().toLowerCase()
                    ? 'Convierte cantidad y precio a esa unidad y documenta la conversión.'
                    : ''}
                </p>
              )}
              <strong>Importe: {money(l.quantity * l.unitPrice)}</strong>
            </div>
          );
        })}
        <button
          className="secondary"
          type="button"
          disabled={lines.length >= 100}
          onClick={() => setLines([...lines, blankLine()])}
        >
          <Plus size={15} />
          Agregar partida
        </button>
        <p>
          <strong>Subtotal calculado: {money(subtotal)}</strong>
        </p>
        <div className="form-grid">
          {(['subtotal', 'tax', 'total'] as const).map((k) => (
            <Field
              key={k}
              label={
                {
                  subtotal: 'Subtotal del original',
                  tax: 'Impuestos del original',
                  total: 'Total del original',
                }[k]
              }
            >
              <input
                name={k}
                type="number"
                min="0"
                max="1000000000000"
                step=".01"
                defaultValue={source?.[k] ?? ''}
                placeholder="Vacío si no aparece"
              />
            </Field>
          ))}
        </div>
        <Field label="Notas de revisión / conversiones">
          <textarea
            name="note"
            required
            maxLength={2000}
            rows={2}
            defaultValue={doc.reviewed?.note || ''}
            placeholder="Registra aclaraciones, conversiones o campos completados"
          />
        </Field>
        <label className="document-confirm">
          <input
            type="checkbox"
            required
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          Cotejé proveedor, folio, fecha, moneda, materiales, unidades, cantidades y precios con el
          original.
        </label>
        <button className="primary" disabled={!confirmed}>
          <Check size={16} />
          Confirmar revisión
        </button>
        <p className="small-note">
          Guardar la revisión todavía no crea compras, entradas ni pagos. Solo se admiten materiales
          en MXN; impuestos separados y precios netos.
        </p>
      </fieldset>
    </form>
  );
}
