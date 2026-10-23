'use client';
import { useState } from 'react';
import { Download, FileText } from 'lucide-react';
import type { Data } from './types';
export async function downloadLogPdf(path: string, body?: unknown) {
  const response = await fetch('/api/' + path, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: 'No se pudo generar el expediente' }));
    throw new Error(error.message);
  }
  const blob = await response.blob(),
    url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download =
    response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ||
    'Expediente_bitacoras.pdf';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export function LogPdfButton({ id, disabled }: { id: string; disabled?: boolean }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <div className="log-pdf-action">
      <button
        type="button"
        className="secondary"
        disabled={disabled || busy}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            await downloadLogPdf(`logs/${id}/pdf`);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Download size={16} />
        {busy ? 'Preparando PDF…' : 'Descargar expediente PDF'}
      </button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}
export function LogExportDialog({
  data,
  projectId,
  busy,
  setBusy,
  close,
}: {
  data: Data;
  projectId: string;
  busy: boolean;
  setBusy: (v: boolean) => void;
  close: () => void;
}) {
  const [project, setProject] = useState(
      projectId === 'all' ? data.projects[0]?.id || '' : projectId,
    ),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [drafts, setDrafts] = useState(false),
    [photos, setPhotos] = useState(true),
    [error, setError] = useState(''),
    [done, setDone] = useState(false);
  const logs = data.logs.filter((l) => l.projectId === project),
    dates = logs.map((l) => l.date.slice(0, 10)).sort(),
    start = from || dates[0] || '',
    end = to || dates.at(-1) || '';
  const selected = logs.filter(
    (l) =>
      l.date.slice(0, 10) >= start &&
      l.date.slice(0, 10) <= end &&
      (drafts || l.status === 'CLOSED'),
  );
  return (
    <>
      <span className="eyebrow">DOCUMENTACIÓN / ENTREGA AL CLIENTE</span>
      <h2>Expediente de bitácoras</h2>
      <p className="dialog-sub">
        PDF en tamaño A4, listo para imprimir: portada, índice, textos completos, adendas, fotos y
        espacio para firmas de entrega.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError('');
          setDone(false);
          setBusy(true);
          const form = new FormData(e.currentTarget);
          try {
            await downloadLogPdf('logs/export', {
              projectId: project,
              from: start,
              to: end,
              includeDrafts: drafts,
              includePhotos: photos,
              company: form.get('company'),
            });
            setDone(true);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset className="log-export-fields" disabled={busy}>
          <label className="field">
            <span>Obra del expediente</span>
            <select
              value={project}
              required
              onChange={(e) => {
                setProject(e.target.value);
                setFrom('');
                setTo('');
                setDone(false);
              }}
            >
              {data.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Nombre de la empresa en portada (opcional)</span>
            <input name="company" maxLength={120} placeholder="Nombre comercial o razón social" />
          </label>
          <div className="form-grid">
            <label className="field">
              <span>Desde</span>
              <input
                type="date"
                required
                value={start}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setDone(false);
                }}
              />
            </label>
            <label className="field">
              <span>Hasta</span>
              <input
                type="date"
                required
                min={start}
                value={end}
                onChange={(e) => {
                  setTo(e.target.value);
                  setDone(false);
                }}
              />
            </label>
          </div>
          <label className="document-confirm">
            <input
              type="checkbox"
              checked={photos}
              onChange={(e) => {
                setPhotos(e.target.checked);
                setDone(false);
              }}
            />
            Incluir fotografías y sus descripciones
          </label>
          <label className="document-confirm">
            <input
              type="checkbox"
              checked={drafts}
              onChange={(e) => {
                setDrafts(e.target.checked);
                setDone(false);
              }}
            />
            Incluir borradores identificados como pendientes de cierre
          </label>
          <div className="experience-notice">
            <FileText size={18} />
            <p>
              {selected.length} registro(s) ·{' '}
              {selected.reduce(
                (n, l) => n + l.attachments.filter((a) => a.mime.startsWith('image/')).length,
                0,
              )}{' '}
              fotografías disponibles. Se incluyen todas las bitácoras del periodo y estado
              elegidos, sin aplicar la búsqueda de la pantalla.
            </p>
            <p>
              Hasta 30 registros y 100 MB de fotos por expediente. Los audios se relacionan como
              anexos digitales; no se imprime ninguna transcripción sin revisar.
            </p>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {done && (
            <p role="status" className="experience-notice">
              PDF descargado. Puedes abrirlo e imprimirlo al 100 % en A4.
            </p>
          )}
          <div className="dialog-actions">
            <button className="secondary" type="button" onClick={close}>
              Cerrar
            </button>
            <button className="primary" disabled={!selected.length || selected.length > 30}>
              <Download size={16} />
              {busy ? 'Preparando expediente…' : 'Descargar PDF'}
            </button>
          </div>
        </fieldset>
      </form>
    </>
  );
}
