'use client';
import { useViewPreference } from '../../shared/use-view-preference';
import { ArrowRight, History, Plus, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useCan } from '../../access';
import { EntryModal } from '../../entry-modal';
import type { Data } from '../../types';
import { ChangeDetail } from './change-detail';
import { CreateChange } from './create-change';
import { changeLabels, day, money, Save } from './helpers';
export function ChangesPanel({
  data,
  projectId,
  busy,
  error,
  save,
  refresh,
}: {
  data: Data;
  projectId: string;
  busy: boolean;
  error: string;
  save: Save;
  refresh: () => Promise<void>;
}) {
  const can = useCan();
  const [create, setCreate] = useState(false),
    [selectedId, setSelectedId] = useState(''),
    [filter, setFilter] = useViewPreference<string>(
      data.user.id,
      'changes',
      projectId,
      'filter',
      'all',
    ),
    [search, setSearch] = useViewPreference<string>(
      data.user.id,
      'changes',
      projectId,
      'search',
      '',
    );
  const errorAnchor = useRef<HTMLDivElement>(null);
  const projects = data.projects.filter((p) => projectId === 'all' || p.id === projectId),
    changes = data.changes.filter((c) => projectId === 'all' || c.projectId === projectId),
    selected = changes.find((c) => c.id === selectedId);

  useEffect(() => {
    if (error) errorAnchor.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [error]);
  const visible = changes.filter(
    (c) =>
      (filter === 'all' || c.status === filter) &&
      [c.title, c.project.name, 'CAM-' + c.number]
        .join(' ')
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <div className="changes-module">
      <div className="plans-actions">
        <p className="small-note">Proponer → autorizar → ejecutar → registrar cobro o crédito.</p>
        <button
          className="primary"
          disabled={busy || !can('changes') || !projects.some((p) => p.status === 'ACTIVE')}
          onClick={() => setCreate(true)}
        >
          <Plus size={16} />
          Solicitar cambio
        </button>
      </div>
      {error && (
        <div ref={errorAnchor} className="error plan-anchor" role="alert">
          {error}
          <button className="text-button" disabled={busy} onClick={refresh}>
            <RefreshCw size={14} />
            Actualizar datos
          </button>
        </div>
      )}
      <div className="mini-stats">
        <div>
          <span>Línea base · costo directo</span>
          <strong>
            {money(projects.reduce((n, p) => n + Number(p.changeSummary.baseBudget), 0))}
          </strong>
        </div>
        <div>
          <span>Cambios aprobados · costo</span>
          <strong>
            {money(projects.reduce((n, p) => n + Number(p.changeSummary.approvedCostDelta), 0))}
          </strong>
        </div>
        <div>
          <span>Costo directo ajustado</span>
          <strong>
            {money(projects.reduce((n, p) => n + Number(p.changeSummary.adjustedBudget), 0))}
          </strong>
        </div>
      </div>
      <p className="small-note">
        Las propuestas en borrador, rechazadas, canceladas o por autorizar quedan fuera del
        presupuesto ajustado.
      </p>
      {projects.length === 1 && (
        <div className="change-notice">
          <p>
            Término base: {day(projects[0].endDate)} · Variación aprobada:{' '}
            {projects[0].changeSummary.approvedDaysDelta} días ·{' '}
            <strong>Término ajustado: {day(projects[0].changeSummary.adjustedEndDate)}</strong>
          </p>
        </div>
      )}
      {create && (
        <EntryModal
          title="Solicitar cambio"
          busy={busy}
          error={error}
          onClose={() => setCreate(false)}
        >
          <CreateChange
            data={data}
            projectId={projectId}
            busy={busy}
            save={save}
            onCancel={() => setCreate(false)}
            onDone={() => {
              setCreate(false);
              setFilter('all');
              setSearch('');
            }}
          />
        </EntryModal>
      )}
      <div className="changes-grid">
        <section className="panel change-list">
          <div className="panel-head">
            <div>
              <h2>Solicitudes de cambio</h2>
              <p>{changes.length} solicitudes en esta vista</p>
            </div>
          </div>
          <div className="issue-filters">
            <input
              aria-label="Buscar cambio u obra"
              placeholder="Buscar cambio u obra…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              aria-label="Estado del cambio"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">Todos los estados</option>
              {Object.entries(changeLabels).map(([key, label]) => (
                <option value={key} key={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {!visible.length && (
            <div className="empty">
              <History size={26} />
              <h3>Sin cambios en este filtro</h3>
              <p>Crea una solicitud o ajusta los filtros.</p>
            </div>
          )}
          {visible.map((c) => (
            <button
              className={'issue-row ' + (selectedId === c.id ? 'selected' : '')}
              key={c.id}
              disabled={busy}
              onClick={() => {
                setSelectedId(c.id);
                setCreate(false);
              }}
            >
              <div className="issue-row-top">
                <strong>
                  CAM-{c.number} · rev. {c.proposals[0].number}
                </strong>
                <span className={'change-status ' + c.status}>{changeLabels[c.status]}</span>
              </div>
              <h3>{c.title}</h3>
              <p>
                {c.project.code} · {c.project.name}
              </p>
              <small>
                Costo {money(c.proposals[0].costDelta)} · {c.proposals[0].daysDelta > 0 ? '+' : ''}
                {c.proposals[0].daysDelta} días
              </small>
              {c.status === 'APPROVED' && (
                <p>
                  {c.progress}% ejecutado · {money(c.outstanding)}{' '}
                  {c.settlementKind === 'CREDIT' ? 'de crédito pendiente' : 'por cobrar'}
                </p>
              )}
              <span className="change-open">
                Ver solicitud <ArrowRight size={14} />
              </span>
            </button>
          ))}
        </section>
        {selected && (
          <EntryModal
            title={'Solicitud CAM-' + selected.number}
            busy={busy}
            error={error}
            onClose={() => setSelectedId('')}
          >
            <ChangeDetail
              key={selected.id + ':' + selected.revision}
              change={selected}
              busy={busy}
              save={save}
            />
          </EntryModal>
        )}
      </div>
    </div>
  );
}
