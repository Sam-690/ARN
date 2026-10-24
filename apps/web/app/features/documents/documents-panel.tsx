'use client';
import { useViewPreference } from '../../shared/use-view-preference';
import { FileText, RefreshCw, Upload } from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useCan } from '../../access';
import { EntryModal } from '../../entry-modal';
import type { Data } from '../../types';
import { ApplyForm } from './apply-form';
import { Field, kinds, labels, Save } from './helpers';
import { Preview } from './preview';
import { ReviewForm } from './review-form';
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
    [search, setSearch] = useViewPreference<string>(
      data.user.id,
      'documents',
      projectId,
      'search',
      '',
    ),
    [filter, setFilter] = useViewPreference<string>(
      data.user.id,
      'documents',
      projectId,
      'filter',
      'all',
    ),
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
