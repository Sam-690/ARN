'use client';
import type { Project, Material } from '../../types';
import { Download } from 'lucide-react';
import type { ForecastResult } from '../../types';
import { qty } from './helpers';
export function ForecastProjection({
  p,
  m,
  result,
  exportScenario,
  comparisonDirty,
}: {
  p: Project | undefined;
  m: Material | undefined;
  result: ForecastResult;
  exportScenario: () => void;
  comparisonDirty: boolean;
}) {
  return (
    <section className="panel experience-form">
      <div className="panel-head">
        <div>
          <span className="eyebrow">
            {p?.code} · {m?.name}
          </span>
          <h2>
            {!result.history.sufficient && !result.needs.length
              ? 'Sin datos suficientes para proyectar'
              : Number(result.required) > 0
                ? 'Hay una brecha de abastecimiento'
                : 'Cobertura dentro del escenario'}
          </h2>
          <p className="small-note">
            Calculado {new Date(result.generatedAt).toLocaleString('es-MX')} · Actualiza el cálculo
            si cambian las compras o el almacén.
          </p>
        </div>
        <button className="secondary" onClick={exportScenario} disabled={comparisonDirty}>
          <Download size={16} />
          Exportar escenario
        </button>
      </div>
      <div className="mini-stats">
        <div>
          <span>Existencia utilizable</span>
          <strong>
            {qty(result.usable)} {m?.unit}
          </strong>
        </div>
        <div>
          <span>Aporte adicional mínimo en el horizonte</span>
          <strong>
            {qty(result.required)} {m?.unit}
          </strong>
        </div>
        <div>
          <span>Primera brecha / pedir a más tardar</span>
          <strong>{result.firstShortage || 'Sin brecha'}</strong>
          <small>{result.orderBy || 'Sin fecha requerida'}</small>
        </div>
      </div>
      <p className="experience-notice">
        {result.history.sufficient
          ? `Ritmo observado: ${qty(result.history.dailyRate!)} ${m?.unit}/día natural. Reserva preventiva: ${qty(result.safety)} ${m?.unit}.`
          : 'Historial insuficiente: se necesitan al menos 7 días observables y salidas en 3 días distintos. Solo se evalúan necesidades planificadas; no se estima una reserva por consumo.'}{' '}
        {result.history.activeDays} días con salidas de {result.history.observedDays} observados.
      </p>
      {!result.history.sufficient && !result.needs.length && (
        <p className="error">
          Sin necesidades abiertas ni historial suficiente: este resultado no demuestra que la obra
          esté abastecida.
        </p>
      )}
      <details className="change-history">
        <summary>Cómo se calcula y qué queda fuera</summary>
        <p>
          Se toman hasta 28 días completos anteriores a hoy, desde el inicio de la obra. El ritmo es
          la suma de salidas dividida entre todos los días naturales observados, incluidos los días
          sin consumo. Hoy queda fuera para no usar un día incompleto.
        </p>
        <p>
          La demanda acumulada usa el mayor valor entre planificación y tendencia, más la reserva
          preventiva. Se consideran dos estimaciones de la misma demanda: no se suman. Si
          corresponden a trabajos distintos, incorpora sus necesidades explícitas en Abastecimiento.
        </p>
        <p>
          Las entradas aprobadas se cuentan en su fecha esperada, antes del consumo del día. Una
          compra vencida o un traspaso en tránsito no se considera existencia. El aporte adicional
          es la mayor brecha diaria; una entrada posterior no elimina una falta anterior.
        </p>
        <p>
          Son salidas operativas de esta obra, que pueden contener datos de demostración del piloto.
          No se extrapolan registros de prueba de la biblioteca ni avances sin un vínculo comprobado
          con el material. El modelo supone continuidad del ritmo, sin calendario por actividad,
          estacionalidad ni probabilidades estadísticas.
        </p>
      </details>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Plan acumulado</th>
              <th>Tendencia acumulada</th>
              <th>Entradas acumuladas</th>
              <th>Saldo previsto*</th>
            </tr>
          </thead>
          <tbody>
            {result.daily.map((d) => (
              <tr key={d.date}>
                <td>{d.date}</td>
                <td>{qty(d.planned)}</td>
                <td>{d.trend === null ? 'Sin estimación' : qty(d.trend)}</td>
                <td>{qty(d.arrivals)}</td>
                <td>
                  <span className={Number(d.balance) < 0 ? 'forecast-negative' : ''}>
                    {qty(d.balance)} {m?.unit}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small-note">
        * Después de la reserva preventiva. Un saldo negativo indica brecha, no inventario real
        negativo.
      </p>
      <details className="change-history">
        <summary>Fuentes del cálculo</summary>
        <h3>
          Salidas · {result.history.start} a {result.history.end}
        </h3>
        {result.history.sources.length ? (
          result.history.sources.map((s) => (
            <p key={s.id}>
              {s.date} · {qty(s.quantity)} {m?.unit} · {s.reference} · <small>{s.id}</small>
            </p>
          ))
        ) : (
          <p>Sin salidas en el periodo.</p>
        )}
        <h3>Necesidades abiertas</h3>
        {result.needs.map((n) => (
          <p key={n.id}>
            {n.date} · {qty(n.quantity)} {m?.unit} · {n.purpose}
          </p>
        ))}
        <h3>Compras pendientes</h3>
        {result.pending.map((o, i) => (
          <p key={i}>
            OC-{o.number} · {qty(o.quantity)} {m?.unit} · {o.date}{' '}
            {o.date < result.asOf
              ? '· Vencida: excluida'
              : o.date > result.daily.at(-1)!.date
                ? '· Fuera del horizonte'
                : '· Fecha esperada, no recepción'}
          </p>
        ))}
      </details>
    </section>
  );
}
