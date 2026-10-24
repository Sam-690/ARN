'use client';
import type { Project } from '../../types';
import { day, money } from './helpers';
export function BudgetAdjustment({ project: p }: { project: Project }) {
  const s = p.changeSummary;
  if (!s) return null;
  return (
    <div className="budget-adjustment">
      <div className="mini-stats">
        <div>
          <span>Línea base directa</span>
          <strong>{money(s.baseBudget)}</strong>
        </div>
        <div>
          <span>Cambios aprobados · costo</span>
          <strong>{money(s.approvedCostDelta)}</strong>
        </div>
        <div>
          <span>Presupuesto directo ajustado</span>
          <strong>{money(s.adjustedBudget)}</strong>
        </div>
      </div>
      <p>
        Término base: <strong>{day(p.endDate)}</strong> · Variación autorizada:{' '}
        <strong>
          {s.approvedDaysDelta > 0 ? '+' : ''}
          {s.approvedDaysDelta} días
        </strong>{' '}
        · Término ajustado: <strong>{day(s.adjustedEndDate)}</strong>
      </p>
    </div>
  );
}
