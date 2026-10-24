'use client';
import { AlertCircle, ArrowRight, CalendarDays, Users } from 'lucide-react';
import { Dialog } from '../../shared/navigation';
import { Badge, day, Empty, Toolbar } from '../../shared/presentation';
import type { Log } from '../../types';
export function LogsView({
  search,
  setSearch,
  filter,
  setFilter,
  logs,
  matches,
  openDialog,
}: {
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  filter: string;
  setFilter: React.Dispatch<React.SetStateAction<string>>;
  logs: Log[];
  matches: (...s: string[]) => boolean;
  openDialog: (d: Dialog) => void;
}) {
  return (
    <>
      <Toolbar
        search={search}
        onSearch={setSearch}
        placeholder="Buscar actividad, obra o responsable…"
      >
        <select
          aria-label="Estado de bitácora"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">Todas las bitácoras</option>
          <option value="DRAFT">Borradores</option>
          <option value="CLOSED">Cerradas</option>
        </select>
      </Toolbar>
      <div className="log-cards">
        {logs
          .filter(
            (l) =>
              (filter === 'all' || l.status === filter) &&
              matches(l.title, l.project.name, l.author, l.activities),
          )
          .map((l) => (
            <article className="panel log-card" key={l.id}>
              <div className="log-card-top">
                <span>
                  <CalendarDays size={15} />
                  {day(l.date)}
                </span>
                <Badge status={l.status} />
              </div>
              <span className="eyebrow">{l.project.name}</span>
              <h2>{l.title}</h2>
              <p className="clamp">{l.activities}</p>
              <p className="small-note">
                {l.front && <>{l.front} · </>}
                {l.attachments.length} archivos · {l.addenda.length} adendas
              </p>
              {l.incident && (
                <div className="incident">
                  <AlertCircle size={15} />
                  <span>1 pendiente registrado</span>
                </div>
              )}
              <div className="log-card-bottom">
                <span>
                  <Users size={15} />
                  {l.crew} personas
                </span>
                <button
                  className="text-button"
                  onClick={() => openDialog({ type: 'logDetail', item: l })}
                >
                  Leer bitácora <ArrowRight size={15} />
                </button>
              </div>
            </article>
          ))}
      </div>
      {!logs.filter(
        (l) =>
          (filter === 'all' || l.status === filter) &&
          matches(l.title, l.project.name, l.author, l.activities),
      ).length && (
        <Empty
          title="Sin bitácoras para mostrar"
          description="Agrega un registro de campo o cambia los filtros."
        />
      )}
    </>
  );
}
