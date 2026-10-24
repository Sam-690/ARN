'use client';
import { useViewPreference } from '../../shared/use-view-preference';
import { BookOpen, Plus, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useCan } from '../../access';
import { EntryModal } from '../../entry-modal';
import type { Data } from '../../types';
import { FamilyForm } from './family-form';
import { GroupCard } from './group-card';
import { day, money, qty, Save, statusLabels } from './helpers';
import { RecordDetail } from './record-detail';
import { RecordForm } from './record-form';
export function ExperiencePanel({
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
  const [mode, setMode] = useState(''),
    [selected, setSelected] = useState(''),
    [filter, setFilter] = useViewPreference<string>(
      data.user.id,
      'experience',
      projectId,
      'filter',
      'all',
    ),
    [search, setSearch] = useViewPreference<string>(
      data.user.id,
      'experience',
      projectId,
      'search',
      '',
    );
  const errorRef = useRef<HTMLDivElement>(null);
  const records = data.experience.records.filter(
      (r) => projectId === 'all' || r.projectId === projectId,
    ),
    groups =
      projectId === 'all' ? data.experience.groups : data.experience.byProject[projectId] || [],
    record = records.find((r) => r.id === selected),
    visible = records.filter(
      (r) =>
        (filter === 'all' || (filter === 'test' ? r.isTest : !r.isTest && r.status === filter)) &&
        [r.reference, r.front, r.budgetSnapshot.name, 'EXP-' + r.number]
          .join(' ')
          .toLowerCase()
          .includes(search.toLowerCase()),
    );
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [error]);
  return (
    <div className="experience-module">
      <div className="plans-actions">
        <p className="small-note">
          Registrar ejecución → cotejar fuentes → validar muestra → comparar.
        </p>
        <div className="log-actions">
          <button
            disabled={busy || !can('families')}
            className="secondary"
            onClick={() => setMode(mode === 'family' ? '' : 'family')}
          >
            Nuevo grupo comparable
          </button>
          <button
            className="primary"
            disabled={
              busy ||
              !can('experience') ||
              !data.projects.some(
                (p) =>
                  p.status === 'ACTIVE' &&
                  p.budgetApproved &&
                  (projectId === 'all' || p.id === projectId),
              )
            }
            onClick={() => setMode(mode === 'record' ? '' : 'record')}
          >
            <Plus size={16} />
            Registrar ejecución
          </button>
        </div>
      </div>
      {error && (
        <div ref={errorRef} className="error" role="alert">
          {error}
          <button className="text-button" onClick={refresh} disabled={busy}>
            Actualizar datos
          </button>
        </div>
      )}
      <div className="mini-stats">
        <div>
          <span>Muestras reales validadas</span>
          <strong>{records.filter((r) => !r.isTest && r.status === 'VALIDATED').length}</strong>
        </div>
        <div>
          <span>Registros reales por validar</span>
          <strong>{records.filter((r) => !r.isTest && r.status === 'RECORDED').length}</strong>
        </div>
        <div>
          <span>Pruebas excluidas</span>
          <strong>{records.filter((r) => r.isTest && r.status !== 'VOID').length}</strong>
        </div>
      </div>
      {mode && (
        <EntryModal
          title={mode === 'family' ? 'Nuevo grupo comparable' : 'Registrar ejecución'}
          busy={busy}
          error={error}
          onClose={() => setMode('')}
        >
          {mode === 'family' ? (
            <FamilyForm save={save} busy={busy} onDone={() => setMode('')} />
          ) : (
            <RecordForm
              data={data}
              projectId={projectId}
              busy={busy}
              save={save}
              onDone={() => setMode('')}
            />
          )}
        </EntryModal>
      )}
      <div className="panel experience-intro">
        <BookOpen size={24} />
        <div>
          <h2>Referencias de trabajos comparables</h2>
          <p>
            Solo registros reales validados, separados por grupo, versión y cobertura de costos.{' '}
            {projectId === 'all' ? 'Todas las obras.' : 'Solo la obra seleccionada.'}
          </p>
        </div>
      </div>
      {!groups.length ? (
        <div className="panel empty">
          <h3>Aún no hay muestras reales validadas</h3>
          <p>
            Los registros de prueba y pendientes no generan promedios. Empieza definiendo un grupo
            comparable.
          </p>
        </div>
      ) : (
        groups.map((g) => <GroupCard key={g.key} group={g} data={data} onSelect={setSelected} />)
      )}
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Registros de ejecución</h2>
            <p>{records.length} registros con fuente e historial</p>
          </div>
          <button
            className="icon-button"
            aria-label="Actualizar experiencia"
            disabled={busy}
            onClick={refresh}
          >
            <RefreshCw size={17} />
          </button>
        </div>
        <div className="issue-filters">
          <input
            aria-label="Buscar experiencia"
            placeholder="Buscar concepto, frente o referencia…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label="Estado de experiencia"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Todos los registros</option>
            <option value="RECORDED">Reales por validar</option>
            <option value="VALIDATED">Reales validados</option>
            <option value="test">Pruebas</option>
            <option value="VOID">Reales anulados</option>
          </select>
        </div>
        {!visible.length && (
          <div className="empty">
            <p>No hay registros en este filtro.</p>
          </div>
        )}
        {visible.map((r) => (
          <button
            className={'issue-row ' + (selected === r.id ? 'selected' : '')}
            key={r.id}
            disabled={busy}
            onClick={() => setSelected(r.id)}
          >
            <div className="issue-row-top">
              <strong>
                EXP-{r.number} · {r.reference}
              </strong>
              <span className="badge">
                {r.isTest
                  ? r.status === 'VOID'
                    ? 'Prueba anulada'
                    : 'Prueba excluida'
                  : statusLabels[r.status]}
              </span>
            </div>
            <h3>{r.budgetSnapshot.name}</h3>
            <p>
              {r.project.name} · {r.front} · {day(r.startDate)} a {day(r.endDate)}
            </p>
            <small>
              {qty(r.quantity)} {r.family.unit} · {money(r.metrics.recordedCost)} ·{' '}
              {r.coverage === 'DIRECT_COMPLETE' ? 'Directo completo declarado' : 'Solo materiales'}
            </small>
          </button>
        ))}
      </section>
      {record && (
        <EntryModal
          title={'Registro EXP-' + record.number}
          busy={busy}
          error={error}
          onClose={() => setSelected('')}
        >
          <RecordDetail
            key={record.id + ':' + record.revision}
            record={record}
            busy={busy}
            save={save}
          />
        </EntryModal>
      )}
      <details className="panel experience-form">
        <summary>Grupos comparables disponibles ({data.experience.families.length})</summary>
        {data.experience.families.map((f) => (
          <article className="experience-family" key={f.id}>
            <strong>
              {f.code} · {f.name} · {f.version} · {f.unit}
            </strong>
            <p>{f.method}</p>
            <p>{f.conditions}</p>
          </article>
        ))}
      </details>
    </div>
  );
}
