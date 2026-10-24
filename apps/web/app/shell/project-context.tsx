'use client';
import { ArrowRight, Building2 } from 'lucide-react';
import { Page } from '../shared/navigation';
import { Badge } from '../shared/presentation';
import type { Project } from '../types';
export function ProjectContext({
  selected,
  globalPage,
  page,
  go,
}: {
  selected: Project | undefined;
  globalPage: boolean;
  page: Page;
  go: (p: Page) => void;
}) {
  return (
    <section
      className={'project-context ' + (selected ? 'is-selected' : '')}
      aria-label="Contexto de obra"
    >
      <div className="context-identity">
        <span className="context-icon">
          <Building2 size={22} />
        </span>
        <div>
          <span className="eyebrow">{selected ? 'OBRA DE TRABAJO' : 'VISTA DE LA EMPRESA'}</span>
          <strong>{selected ? `${selected.code} · ${selected.name}` : 'Todas las obras'}</strong>
          <p>
            {globalPage
              ? page === 'projects'
                ? 'Este listado siempre muestra todas tus obras. Abre una para ver su resumen.'
                : page === 'team'
                  ? 'Administración global de cuentas y acceso por obra.'
                  : 'Catálogo compartido por todas las obras de la empresa.'
              : selected
                ? `${selected.location} · ${selected.status === 'CLOSED' ? 'Obra cerrada · consulta de registros' : 'Los datos de este módulo corresponden a esta obra.'}`
                : 'Los datos de este módulo reúnen todas tus obras.'}
          </p>
        </div>
      </div>
      <div className="context-actions">
        {selected && <Badge status={selected.status} />}
        <button className="secondary" onClick={() => go('projects')}>
          Ver todas las obras <ArrowRight size={14} />
        </button>
      </div>
    </section>
  );
}
