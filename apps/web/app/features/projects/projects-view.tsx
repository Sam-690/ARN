'use client';
import { ArrowRight, Building2, CalendarDays, Check, MapPin, Users } from 'lucide-react';
import { Dialog } from '../../shared/navigation';
import { Badge, day, Empty, money, Toolbar } from '../../shared/presentation';
import type { Project } from '../../types';
export function ProjectsView({
  search,
  setSearch,
  filter,
  setFilter,
  allProjects,
  matches,
  selected,
  openProject,
  can,
  openDialog,
}: {
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  filter: string;
  setFilter: React.Dispatch<React.SetStateAction<string>>;
  allProjects: Project[];
  matches: (...s: string[]) => boolean;
  selected: Project | undefined;
  openProject: (id: string) => void;
  can: (permission: string) => boolean;
  openDialog: (d: Dialog) => void;
}) {
  return (
    <>
      <Toolbar search={search} onSearch={setSearch} placeholder="Buscar obra, clave o responsable…">
        <select
          aria-label="Estado de obra"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">Todos los estados</option>
          <option value="ACTIVE">En ejecución</option>
          <option value="CLOSED">Cerradas</option>
        </select>
      </Toolbar>
      <div className="project-cards">
        {allProjects
          .filter(
            (p) => (filter === 'all' || p.status === filter) && matches(p.name, p.code, p.manager),
          )
          .map((p, i) => (
            <article
              key={p.id}
              className={'project-card ' + (selected?.id === p.id ? 'project-card-selected' : '')}
            >
              <div className={'project-cover cover-' + (i % 3)}>
                <div className="blueprint" />
                <span>{p.code}</span>
                <Building2 size={44} strokeWidth={1} />
              </div>
              <div className="project-card-body">
                <div className="project-card-status">
                  <Badge status={p.status} />
                  {selected?.id === p.id && (
                    <span className="selected-label">
                      <Check size={12} />
                      Obra seleccionada
                    </span>
                  )}
                </div>
                <h2>{p.name}</h2>
                <p>
                  <MapPin size={14} />
                  {p.location}
                </p>
                <div className="card-budget">
                  <span>Presupuesto ajustado</span>
                  <strong>{money(p.changeSummary.adjustedBudget)}</strong>
                </div>
                <div className="card-meta">
                  <span>
                    <Users size={14} />
                    {p.manager}
                  </span>
                  <span>
                    <CalendarDays size={14} />
                    {day(p.changeSummary.adjustedEndDate)}
                  </span>
                </div>
                <div className="card-actions">
                  <button className="text-button" onClick={() => openProject(p.id)}>
                    Ver resumen <ArrowRight size={15} />
                  </button>
                  {p.status === 'ACTIVE' && (
                    <button
                      className="subtle"
                      disabled={!can('projects')}
                      onClick={() =>
                        openDialog({
                          type: 'confirm',
                          item: {
                            path: `projects/${p.id}/close`,
                            title: 'Cerrar obra',
                            message:
                              'El proyecto conservará su historial y no admitirá nuevos movimientos. No puede tener compras, inventario, pagos, bitácoras, abastecimiento, traspasos, incidencias o cambios pendientes.',
                          },
                        })
                      }
                    >
                      Cerrar obra
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
      </div>
      {!allProjects.filter(
        (p) => (filter === 'all' || p.status === filter) && matches(p.name, p.code, p.manager),
      ).length && (
        <Empty
          title="No se encontraron obras"
          description="Cambia los filtros o crea un nuevo proyecto."
        />
      )}
    </>
  );
}
