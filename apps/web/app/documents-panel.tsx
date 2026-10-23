'use client';
import { EntryModal } from './entry-modal';
import { useCan } from './access';
import { useEffect, useRef, useState, FormEvent } from 'react';
import { FileText, Plus, Upload, Check, Trash2, Download, RefreshCw } from 'lucide-react';
import type { Data, SourceDocument, DocumentReview } from './types';
type Save = (path: string, body: unknown, message: string) => Promise<boolean>;
const labels: Record<string, string> = {
  DRAFT: 'Por revisar',
  REVIEWED: 'Revisado',
  APPLIED: 'Aplicado',
};
const kinds: Record<string, string> = {
  QUOTE: 'Cotización',
  DELIVERY: 'Remisión',
  INVOICE: 'Factura',
};
const money = (n: number | string) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(n));
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
const blankLine = () => ({ description: '', unit: '', quantity: 0, unitPrice: 0, materialId: '' });
function Preview({ doc }: { doc: SourceDocument }) {
  const [page, setPage] = useState(1),
    [pages, setPages] = useState(1),
    [error, setError] = useState(''),
    host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (doc.mime !== 'application/pdf') return;
    let alive = true,
      task: any,
      render: any;
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-label', 'Página del documento original');
    host.current?.replaceChildren(canvas);
    setError('');
    (async () => {
      const pdfjs = await import('pdfjs-dist');
      if (!alive) return;
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
      task = pdfjs.getDocument({
        url: `/api/documents/${doc.id}/file`,
        withCredentials: true,
        enableXfa: false,
        cMapUrl: '/pdfjs/cmaps/',
        cMapPacked: true,
        standardFontDataUrl: '/pdfjs/standard_fonts/',
        wasmUrl: '/pdfjs/wasm/',
      });
      const pdf = await task.promise;
      if (!alive) return;
      setPages(pdf.numPages);
      const sheet = await pdf.getPage(page);
      if (!alive) return;
      const v = sheet.getViewport({ scale: 1 }),
        viewport = sheet.getViewport({ scale: Math.min(2, 1600 / Math.max(v.width, v.height)) });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      render = sheet.render({ canvas, viewport });
      await render.promise;
    })().catch(() => {
      if (alive) setError('No se pudo mostrar el original. Descárgalo para revisarlo.');
    });
    return () => {
      alive = false;
      render?.cancel();
      void task?.destroy();
    };
  }, [doc.id, doc.mime, page]);
  return (
    <section className="document-original">
      <div className="panel-head">
        <h3>Original conservado</h3>
        <a className="text-button" href={`/api/documents/${doc.id}/file`} download>
          <Download size={15} />
          Descargar
        </a>
      </div>
      <p className="small-note">
        {doc.name} ·{' '}
        {doc.size < 1048576
          ? (doc.size / 1024).toFixed(1) + ' KB'
          : (doc.size / 1048576).toFixed(2) + ' MB'}
      </p>
      {doc.mime === 'application/pdf' ? (
        <>
          <div className="log-actions">
            <button
              type="button"
              className="secondary"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Anterior
            </button>
            <span>
              {page} / {pages}
            </span>
            <button
              type="button"
              className="secondary"
              disabled={page === pages}
              onClick={() => setPage(page + 1)}
            >
              Siguiente
            </button>
          </div>
          <div ref={host} className="document-preview" />
          {error && <p role="alert">{error}</p>}
        </>
      ) : (
        <img
          className="document-image"
          src={`/api/documents/${doc.id}/file`}
          alt="Documento original para cotejar la captura"
        />
      )}
    </section>
  );
}
function ReviewForm({
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
function ApplyForm({
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
export function DocumentsPanel({
  data,
  projectId,
  busy,
  save,
  refresh,
  error: serverError,
}: {
  data: Data;
  projectId: string;
  busy: boolean;
  save: Save;
  error: string;
  refresh: () => Promise<void>;
}) {
  const [selected, setSelected] = useState(''),
    [upload, setUpload] = useState(false),
    [localBusy, setLocalBusy] = useState(false),
    [error, setError] = useState(''),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState('all'),
    [consent, setConsent] = useState(false);
  const can = useCan();
  const errorAnchor = useRef<HTMLDivElement>(null),
    documents = data.documents.filter((d) => projectId === 'all' || d.projectId === projectId),
    doc = documents.find((d) => d.id === selected),
    disabled = busy || localBusy,
    active =
      can('documents') && data.projects.find((p) => p.id === doc?.projectId)?.status === 'ACTIVE';
  useEffect(() => {
    if (serverError || error)
      errorAnchor.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [serverError, error]);
  useEffect(() => {
    setConsent(false);
  }, [selected]);
  async function uploadFile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      file = f.get('file') as File;
    if (!file?.size) return;
    setError('');
    if (file.size > (file.type === 'application/pdf' ? 15 : 8) * 1024 * 1024) {
      setError('Máximo 15 MB para PDF y 8 MB para fotos.');
      return;
    }
    setLocalBusy(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = () => reject(Error('No se pudo leer el archivo'));
        reader.readAsDataURL(file);
      });
      if (
        await save(
          'documents',
          { projectId: f.get('projectId'), name: file.name, mime: file.type, base64 },
          'Original guardado. Selecciónalo para revisar.',
        )
      )
        setUpload(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLocalBusy(false);
    }
  }
  async function extract() {
    if (!doc) return;
    setLocalBusy(true);
    setError('');
    try {
      await save(
        `documents/${doc.id}/extract`,
        { expectedRevision: doc.revision, consent },
        'Lectura preparada; revisa todos los campos',
      );
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLocalBusy(false);
      setConsent(false);
    }
  }
  return (
    <div className="documents-module">
      <div className="plans-actions">
        <p className="small-note">01 Guardar original → 02 Revisar datos → 03 Aplicar a compra</p>
        <button
          className="primary"
          disabled={
            disabled ||
            !can('documents') ||
            !data.projects.some(
              (p) => p.status === 'ACTIVE' && (projectId === 'all' || p.id === projectId),
            )
          }
          onClick={() => {
            setUpload(!upload);
            setSelected('');
          }}
        >
          <Upload size={16} />
          Cargar documento
        </button>
      </div>
      <div className="mini-stats">
        {[
          ['Por revisar', documents.filter((d) => d.status === 'DRAFT').length],
          ['Listos para aplicar', documents.filter((d) => d.status === 'REVIEWED').length],
          ['Aplicados', documents.filter((d) => d.status === 'APPLIED').length],
        ].map(([label, n]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{n}</strong>
          </div>
        ))}
      </div>
      {(serverError || error) && (
        <div ref={errorAnchor} className="error" role="alert">
          {serverError || error}
        </div>
      )}
      {upload && (
        <EntryModal
          title="Cargar documento"
          busy={disabled}
          error={serverError || error}
          onClose={() => setUpload(false)}
        >
          <form className="panel document-upload" onSubmit={uploadFile}>
            <h2>Guardar un original</h2>
            <fieldset disabled={disabled}>
              <Field label="Obra del documento">
                <select
                  name="projectId"
                  required
                  defaultValue={projectId === 'all' ? '' : projectId}
                >
                  <option value="">Selecciona una obra</option>
                  {data.projects
                    .filter(
                      (p) => p.status === 'ACTIVE' && (projectId === 'all' || p.id === projectId),
                    )
                    .map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.code} · {p.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="PDF o foto">
                <input
                  name="file"
                  type="file"
                  required
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                />
              </Field>
              <p className="small-note">
                PDF hasta 15 MB y 20 páginas; JPG, PNG o WebP hasta 8 MB. Se conserva el original
                privado y se detectan archivos repetidos.
              </p>
              <button className="primary">{disabled ? 'Guardando…' : 'Guardar original'}</button>
            </fieldset>
          </form>
        </EntryModal>
      )}
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Bandeja documental</h2>
            <p>Cotizaciones, remisiones y facturas por obra.</p>
          </div>
          <button
            className="icon-button"
            aria-label="Actualizar documentos"
            disabled={disabled}
            onClick={async () => {
              try {
                await refresh();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <RefreshCw size={17} />
          </button>
        </div>
        <div className="issue-filters">
          <input
            aria-label="Buscar documento"
            placeholder="Buscar archivo, proveedor o folio…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label="Estado del documento"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Todos los estados</option>
            {Object.entries(labels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="document-list">
          {documents
            .filter(
              (d) =>
                (filter === 'all' || d.status === filter) &&
                [d.name, d.reviewed?.supplier, d.reviewed?.folio, 'DOC-' + d.number]
                  .join(' ')
                  .toLowerCase()
                  .includes(search.toLowerCase()),
            )
            .map((d) => (
              <button
                key={d.id}
                className={'issue-row ' + (selected === d.id ? 'selected' : '')}
                disabled={disabled}
                onClick={() => {
                  setSelected(d.id);
                  setUpload(false);
                }}
              >
                <div className="issue-row-top">
                  <strong>DOC-{d.number}</strong>
                  <span className="badge">{labels[d.status]}</span>
                </div>
                <h3>{d.name}</h3>
                <p>{data.projects.find((p) => p.id === d.projectId)?.name}</p>
                <small>
                  {d.reviewed
                    ? `${kinds[d.reviewed.kind]} · ${d.reviewed.supplier} · ${d.reviewed.folio}`
                    : 'Datos pendientes de revisión'}
                </small>
              </button>
            ))}
        </div>
        {!documents.length && (
          <div className="empty">
            <FileText size={28} />
            <h3>Empieza con una cotización o remisión</h3>
            <p>Carga un archivo y revisa sus datos antes de afectar compras o almacén.</p>
          </div>
        )}
      </section>
      {doc && (
        <EntryModal
          title={'Documento DOC-' + doc.number}
          wide
          busy={disabled}
          error={serverError || error}
          onClose={() => setSelected('')}
        >
          <div className="document-workspace">
            <section className="panel">
              <Preview key={doc.id} doc={doc} />
            </section>
            <section className="panel document-review">
              <span className="eyebrow">
                DOC-{doc.number} · {labels[doc.status]}
              </span>
              {doc.status === 'DRAFT' && active ? (
                <>
                  <div className="document-extract">
                    <h3>Lectura asistida</h3>
                    {data.capabilities.documentExtraction ? (
                      <>
                        <label className="document-confirm">
                          <input
                            type="checkbox"
                            checked={consent}
                            onChange={(e) => setConsent(e.target.checked)}
                          />
                          Enviar este archivo a OpenAI para extraer sus datos. La lectura puede
                          tener costo y reemplazará los campos sin guardar.
                        </label>
                        <button
                          className="secondary"
                          disabled={disabled || !consent}
                          onClick={extract}
                        >
                          {localBusy ? 'Leyendo…' : 'Extraer datos del original'}
                        </button>
                      </>
                    ) : (
                      <p className="small-note">
                        Lectura automática no configurada. Puedes completar la captura manual junto
                        al original.
                      </p>
                    )}
                    {doc.extractionStatus === 'ERROR' && (
                      <p className="document-warning">
                        La última lectura no terminó. El original está conservado.
                      </p>
                    )}
                    {doc.extractionStatus === 'PROCESSING' && (
                      <p className="small-note">
                        Lectura en curso. Actualiza la bandeja al terminar; si se interrumpió,
                        podrás reintentar después de dos minutos.
                      </p>
                    )}
                  </div>
                  <ReviewForm
                    key={doc.id + ':' + doc.revision}
                    doc={doc}
                    data={data}
                    busy={disabled}
                    save={save}
                  />
                </>
              ) : doc.reviewed ? (
                <fieldset disabled={!active || disabled}>
                  <ApplyForm
                    key={doc.id + ':' + doc.revision}
                    doc={doc}
                    data={data}
                    busy={disabled}
                    save={save}
                  />
                </fieldset>
              ) : (
                <p>Solo consulta del original para esta cuenta u obra.</p>
              )}
              <details className="change-history">
                <summary>Historial del documento</summary>
                {doc.events.map((e) => (
                  <article key={e.id}>
                    <strong>
                      {{
                        UPLOAD: 'Original guardado',
                        EXTRACT: 'Lectura automática',
                        REVIEW: 'Revisión confirmada',
                        REOPEN: 'Corrección abierta',
                        APPLY: 'Aplicado a compra',
                      }[e.action] || e.action}
                    </strong>
                    <small>
                      {e.actor} · {new Date(e.createdAt).toLocaleString('es-MX')}
                    </small>
                    <p>{e.note}</p>
                  </article>
                ))}
              </details>
            </section>
          </div>
        </EntryModal>
      )}
    </div>
  );
}
