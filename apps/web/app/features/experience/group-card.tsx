'use client';
import type { Data, ExperienceGroup } from '../../types';
import { day, money, qty } from './helpers';
export function GroupCard({
  group: g,
  data,
  onSelect,
}: {
  group: ExperienceGroup;
  data: Data;
  onSelect: (id: string) => void;
}) {
  const f = data.experience.families.find((f) => f.id === g.familyId)!;
  return (
    <article className="panel experience-form">
      <span className="eyebrow">
        {f.code} · VERSIÓN {f.version}
      </span>
      <h3>{f.name}</h3>
      <p className="small-note">
        {f.method} · {f.conditions}
      </p>
      <div className="mini-stats">
        <div>
          <span>
            {g.coverage === 'DIRECT_COMPLETE' ? 'Directo completo' : 'Solo materiales'} / {f.unit}
          </span>
          <strong>{money(g.unitCost)}</strong>
        </div>
        <div>
          <span>Muestras / obras</span>
          <strong>
            {g.sampleCount} / {g.projectCount}
          </strong>
        </div>
        <div>
          <span>Ejecutado observado</span>
          <strong>
            {qty(g.quantity)} {f.unit}
          </strong>
        </div>
      </div>
      <p>
        Rango por registro: {money(g.minUnitCost)}–{money(g.maxUnitCost)} / {f.unit}
      </p>
      <p className="small-note">
        Promedio ponderado por cantidad ejecutada. Costos históricos nominales en MXN; no se ajustan
        por fecha, inflación o ubicación.
      </p>
      {g.sampleCount < 3 && (
        <p className="experience-notice">
          Muestra pequeña: {g.sampleCount} registro(s). Es una referencia histórica, no un
          rendimiento garantizado.
        </p>
      )}
      {g.productivity && (
        <p>
          Productividad: {qty(g.productivity)} {f.unit}/hora-persona · {g.hoursSampleCount}{' '}
          registros con horas ({qty(g.laborHours)} h).
        </p>
      )}
      <details className="change-history">
        <summary>Consumos y fuentes verificables</summary>
        {g.materials.map((m) => (
          <article key={m.materialId}>
            <strong>
              {m.name}: {qty(m.consumptionPerUnit)} {m.unit}/{f.unit}
            </strong>
            <p>
              {qty(m.quantity)} {m.unit} asignados en {m.sampleCount} registros; divisor: toda la
              ejecución del grupo ({qty(g.quantity)} {f.unit}).
            </p>
          </article>
        ))}
        {g.sourceIds.map((id) => {
          const r = data.experience.records.find((r) => r.id === id)!;
          return (
            <button key={id} className="text-button" onClick={() => onSelect(id)}>
              EXP-{r.number} · {r.project.name} · {day(r.startDate)} / {day(r.endDate)} ·{' '}
              {qty(r.quantity)} {f.unit}
            </button>
          );
        })}
      </details>
    </article>
  );
}
