'use client';
import type { Data, ForecastResult } from '../../types';
export function SupplierHistory({ result, data }: { result: ForecastResult; data: Data }) {
  return (
    <section className="panel experience-form">
      <h2>Historial de proveedores</h2>
      <p className="small-note">
        Órdenes de tus obras autorizadas que incluyen este material. Se mide entrega completa de la
        orden contra fecha esperada; la fecha de registro de recepción aproxima la entrega física.
        Los nombres equivalentes se agrupan.
      </p>
      {!result.suppliers.length && <p>No hay compras aprobadas para evaluar este material.</p>}
      <div className="forecast-cards">
        {result.suppliers.map((s) => (
          <article className="detail-box" key={s.name}>
            <h3>{s.name}</h3>
            <strong>
              {s.onTimePercent === null ? 'Sin muestra evaluable' : `${s.onTimePercent}% a tiempo`}
            </strong>
            <p>
              {s.onTime} de {s.evaluated} órdenes evaluables · demora media en órdenes completadas:{' '}
              {s.averageDelay === null ? 'Sin datos' : `${s.averageDelay} días`}
            </p>
            {s.evaluated < 3 && (
              <p className="small-note">Muestra pequeña; no garantiza próximas entregas.</p>
            )}
            <details>
              <summary>Ver órdenes y exclusiones</summary>
              {s.sources.map((o) => (
                <p key={o.number}>
                  OC-{o.number} · {data.projects.find((p) => p.id === o.projectId)?.code} ·
                  prometida {o.due} ·{' '}
                  {
                    {
                      ON_TIME: 'Completa a tiempo',
                      LATE: 'Completa con retraso',
                      OVERDUE: 'Pendiente vencida',
                      PENDING: 'Pendiente, aún en plazo',
                      UNKNOWN: 'Sin recepción conciliable; excluida',
                    }[o.result]
                  }
                  {o.completed ? ` · registrada ${o.completed}` : ''}
                </p>
              ))}
            </details>
          </article>
        ))}
      </div>
    </section>
  );
}
