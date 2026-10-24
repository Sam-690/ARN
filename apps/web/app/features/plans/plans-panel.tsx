'use client';
import { useViewPreference } from '../../shared/use-view-preference';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  Layers,
  MapPin,
  Plus,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useCan } from '../../access';
import { EntryModal } from '../../entry-modal';
import { PlanViewer } from './plan-viewer';
import type { Data, PlanIssue } from '../../types';
import { Field, priorityLabel, Save, statusLabel, timestamp, today } from './helpers';
import { IssueDetail } from './issue-detail';
import { NewIssue } from './new-issue';
import { PlanUpload } from './plan-upload';
export function PlansPanel({
  data,
  projectId,
  busy,
  error,
  save,
  setBusy,
  refresh,
}: {
  data: Data;
  projectId: string;
  busy: boolean;
  error: string;
  save: Save;
  setBusy: (v: boolean) => void;
  refresh: () => Promise<void>;
}) {
  const drawings = data.drawings.filter((d) => projectId === 'all' || d.projectId === projectId);
  const [drawingId, setDrawingId] = useState(''),
    [versionId, setVersionId] = useState(''),
    [page, setPage] = useState(1),
    [zoom, setZoom] = useState(100),
    [selectedId, setSelectedId] = useState(''),
    [upload, setUpload] = useState<'new' | 'version' | null>(null),
    [placing, setPlacing] = useState(false),
    [point, setPoint] = useState<{ x: number; y: number } | null>(null),
    [filter, setFilter] = useViewPreference<string>(
      data.user.id,
      'plans',
      projectId,
      'filter',
      'pending',
    ),
    [search, setSearch] = useViewPreference<string>(data.user.id, 'plans', projectId, 'search', '');
  const drawing = drawings.find((d) => d.id === drawingId) || drawings[0],
    version = drawing?.versions.find((v) => v.id === versionId) || drawing?.versions[0];
  const ids = new Set(drawing?.versions.map((v) => v.id));
  const issues = data.planIssues.filter((i) => ids.has(i.versionId)),
    selected = issues.find((i) => i.id === selectedId),
    selectedVersion = drawing?.versions.find((v) => v.id === selected?.versionId);
  const pending = issues.filter((i) => i.status !== 'RESOLVED'),
    oldPending = pending.filter((i) => i.versionId !== drawing?.versions[0]?.id);
  const can = useCan();
  const writable = can('plans') && drawing?.project.status === 'ACTIVE';
  function resetView() {
    setPage(1);
    setSelectedId('');
    setPoint(null);
    setPlacing(false);
    setZoom(100);
  }
  function selectIssue(i: PlanIssue) {
    setSelectedId(i.id);
    setVersionId(i.versionId);
    setPage(i.page);
    setPoint(null);
    setPlacing(false);
  }
  const visible = issues.filter(
    (i) =>
      (filter === 'all' ||
        (filter === 'pending' && i.status !== 'RESOLVED') ||
        i.status === filter) &&
      [i.title, i.assignee, 'INC-' + i.number]
        .join(' ')
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const errorAnchor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) errorAnchor.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [error]);

  const activeAvailable =
    can('plans') &&
    data.projects.some((p) => p.status === 'ACTIVE' && (projectId === 'all' || p.id === projectId));
  return (
    <div className="plans-module">
      <div className="plans-actions">
        <p className="small-note">
          Planos por obra, versiones conservadas y pendientes con ubicación.
        </p>
        <button
          className="primary"
          disabled={busy || !activeAvailable}
          onClick={() => {
            setUpload('new');
            setPoint(null);
            setPlacing(false);
          }}
        >
          <Plus size={16} />
          Registrar plano
        </button>
      </div>
      {error && (
        <div ref={errorAnchor} className="error plan-anchor" role="alert">
          {error}
          <button className="text-button" disabled={busy} onClick={() => refresh().catch(() => {})}>
            <RefreshCw size={14} />
            Actualizar datos
          </button>
        </div>
      )}
      {upload && (
        <EntryModal
          title={upload === 'new' ? 'Registrar plano' : 'Nueva versión de plano'}
          busy={busy}
          error={error}
          onClose={() => setUpload(null)}
        >
          <PlanUpload
            key={upload + (drawing?.id || '')}
            data={data}
            projectId={projectId}
            drawing={upload === 'version' ? drawing : undefined}
            busy={busy}
            save={save}
            setBusy={setBusy}
            onCancel={() => setUpload(null)}
            onDone={() => {
              setUpload(null);
              if (upload === 'new') setDrawingId('');
              setVersionId('');
              resetView();
            }}
          />
        </EntryModal>
      )}
      {!drawings.length && !upload && (
        <div className="panel empty">
          <Layers size={30} />
          <h3>Aún no hay planos en esta vista</h3>
          <p>Registra un PDF para ubicar incidencias y seguir su resolución.</p>
        </div>
      )}
      {drawing && version && (
        <>
          <div className="panel plan-selection">
            <Field label="Plano de trabajo">
              <select
                value={drawing.id}
                disabled={busy}
                onChange={(e) => {
                  setDrawingId(e.target.value);
                  setVersionId('');
                  setUpload(null);
                  resetView();
                }}
              >
                {drawings.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.project.code} · {d.code} · {d.name}
                  </option>
                ))}
              </select>
            </Field>
            <div>
              <span className="eyebrow">{drawing.project.name}</span>
              <h2>
                {drawing.code} · {drawing.name}
              </h2>
              <p>
                {drawing.versions.length} versiones · {pending.length} pendientes ·{' '}
                {issues.filter((i) => i.status === 'RESOLVED').length} resueltas
              </p>
            </div>
          </div>
          {oldPending.length > 0 && (
            <div className="plan-notice">
              <Layers size={18} />
              <p>
                <strong>{oldPending.length} pendientes en versiones anteriores.</strong> Siguen en
                la lista de incidencias. Selecciona uno para abrir su versión y ubicación
                originales.
              </p>
            </div>
          )}
          <section id="current-plan-view" className="panel plan-workspace plan-anchor">
            <div className="plan-tools">
              <Field label="Versión del plano">
                <select
                  value={version.id}
                  disabled={busy}
                  onChange={(e) => {
                    setVersionId(e.target.value);
                    resetView();
                  }}
                >
                  {drawing.versions.map((v, index) => (
                    <option key={v.id} value={v.id}>
                      v{v.number} · {v.label}
                      {index === 0 ? ' · más reciente' : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <button
                className="secondary"
                disabled={busy || !writable}
                onClick={() => {
                  setUpload('version');
                  setPoint(null);
                  setPlacing(false);
                }}
              >
                <Upload size={15} />
                Nueva versión
              </button>
              <a
                className="secondary"
                href={`/api/drawings/${drawing.id}/versions/${version.id}/file`}
              >
                <Download size={15} />
                PDF original
              </a>
            </div>
            <p className="version-description">
              {version.note}{' '}
              <span>
                · {version.author} · {timestamp(version.createdAt)}
              </span>
            </p>
            {version.id !== drawing.versions[0]?.id && (
              <p className="plan-old">
                Consultando una versión anterior. Sus marcadores no se trasladan a la revisión
                nueva.
              </p>
            )}
            <div className="plan-page-tools">
              <button
                className="icon-button"
                aria-label="Página anterior"
                disabled={page <= 1 || busy}
                onClick={() => {
                  setPage(page - 1);
                  setPoint(null);
                  setPlacing(false);
                }}
              >
                <ArrowLeft size={17} />
              </button>
              <Field label="Página del plano">
                <select
                  value={page}
                  disabled={busy}
                  onChange={(e) => {
                    setPage(Number(e.target.value));
                    setPoint(null);
                    setPlacing(false);
                  }}
                >
                  {Array.from({ length: version.pageCount }, (_, i) => (
                    <option key={i} value={i + 1}>
                      Página {i + 1} de {version.pageCount}
                    </option>
                  ))}
                </select>
              </Field>
              <button
                className="icon-button"
                aria-label="Página siguiente"
                disabled={page >= version.pageCount || busy}
                onClick={() => {
                  setPage(page + 1);
                  setPoint(null);
                  setPlacing(false);
                }}
              >
                <ArrowRight size={17} />
              </button>
              <Field label="Ampliación">
                <select value={zoom} onChange={(e) => setZoom(Number(e.target.value))}>
                  <option value="100">Ajustar ancho</option>
                  <option value="150">150 %</option>
                  <option value="200">200 %</option>
                </select>
              </Field>
              <button
                className={placing ? 'primary' : 'secondary'}
                disabled={busy || !writable}
                onClick={() => {
                  setPlacing(!placing);
                  setPoint(null);
                  setSelectedId('');
                }}
              >
                <MapPin size={15} />
                {placing ? 'Cancelar ubicación' : 'Marcar incidencia'}
              </button>
            </div>
            {placing && (
              <div className="plan-notice">
                <p>
                  Pulsa sobre la página para ubicar el pendiente, o{' '}
                  <button
                    className="text-button"
                    onClick={() => {
                      setPoint({ x: 0.5, y: 0.5 });
                      setPlacing(false);
                    }}
                  >
                    ingresa la ubicación por porcentaje
                  </button>
                  .
                </p>
              </div>
            )}
            <PlanViewer
              key={version.id + ':' + page}
              drawingId={drawing.id}
              version={version}
              page={page}
              zoom={zoom}
              issues={issues.filter((i) => i.versionId === version.id && i.page === page)}
              selectedId={selectedId}
              placing={placing && !busy}
              onSelect={selectIssue}
              onPlace={(p) => {
                setPoint(p);
                setPlacing(false);
              }}
            />
            <p className="plan-legend">
              <span className="issue-status OPEN">Abierta</span>
              <span className="issue-status IN_PROGRESS">En atención</span>
              <span className="issue-status RESOLVED">Resuelta</span>
              <span>Marcadores de esta página y versión</span>
            </p>
          </section>
          {point && (
            <EntryModal
              title="Nueva incidencia"
              busy={busy}
              error={error}
              onClose={() => setPoint(null)}
            >
              <NewIssue
                key={version.id + ':' + page + ':' + point.x + ':' + point.y}
                drawing={drawing}
                version={version}
                page={page}
                point={point}
                busy={busy}
                save={save}
                onCancel={() => setPoint(null)}
                onDone={() => setPoint(null)}
              />
            </EntryModal>
          )}
          <div className="plan-bottom">
            <section className="panel issue-list">
              <div className="panel-head">
                <div>
                  <h2>Incidencias del plano</h2>
                  <p>Todas las versiones · selecciona para ubicar y dar seguimiento</p>
                </div>
              </div>
              <div className="issue-filters">
                <input
                  aria-label="Buscar incidencia o responsable"
                  placeholder="Buscar incidencia o responsable…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select
                  aria-label="Filtrar incidencias"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="pending">Pendientes</option>
                  <option value="all">Todas</option>
                  <option value="OPEN">Abiertas</option>
                  <option value="IN_PROGRESS">En atención</option>
                  <option value="RESOLVED">Resueltas</option>
                </select>
              </div>
              {!visible.length && (
                <div className="empty">
                  <Check size={24} />
                  <h3>Sin incidencias en este filtro</h3>
                  <p>Usa «Marcar incidencia» sobre el plano para registrar un pendiente.</p>
                </div>
              )}
              {visible.map((i) => (
                <button
                  key={i.id}
                  className={'issue-row ' + (selectedId === i.id ? 'selected' : '')}
                  disabled={busy}
                  onClick={() => selectIssue(i)}
                >
                  <div className="issue-row-top">
                    <strong>INC-{i.number}</strong>
                    <span className={'issue-status ' + i.status}>{statusLabel[i.status]}</span>
                  </div>
                  <h3>{i.title}</h3>
                  <p>
                    {i.assignee} · vence {i.dueDate.slice(0, 10)}
                  </p>
                  <small>
                    v{drawing.versions.find((v) => v.id === i.versionId)?.number} · página {i.page}{' '}
                    · prioridad {priorityLabel[i.priority].toLowerCase()}
                    {i.status !== 'RESOLVED' && i.dueDate.slice(0, 10) < today()
                      ? ' · VENCIDA'
                      : ''}
                  </small>
                </button>
              ))}
            </section>
            {selected && selectedVersion && (
              <EntryModal
                title={'Incidencia INC-' + selected.number}
                busy={busy}
                error={error}
                onClose={() => setSelectedId('')}
              >
                <button
                  className="secondary locate-issue"
                  disabled={busy}
                  onClick={() => {
                    setSelectedId('');
                    document
                      .getElementById('current-plan-view')
                      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                >
                  <MapPin size={15} />
                  Ver marcador en el plano
                </button>
                <IssueDetail
                  key={selected.id + ':' + selected.revision}
                  issue={selected}
                  version={selectedVersion}
                  drawing={drawing}
                  busy={busy}
                  save={save}
                  setBusy={setBusy}
                  onClose={() => setSelectedId('')}
                />
              </EntryModal>
            )}
          </div>
        </>
      )}
    </div>
  );
}
