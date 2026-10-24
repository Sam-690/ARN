'use client';
import { Calculator, Check, LockKeyhole } from 'lucide-react';
import { BudgetAdjustment } from '../changes';
import { Dialog } from '../../shared/navigation';
import { Empty, money, qty, sumBudget } from '../../shared/presentation';
import type { Project } from '../../types';
export function BudgetView({
  projects,
  can,
  openDialog,
}: {
  projects: Project[];
  can: (permission: string) => boolean;
  openDialog: (d: Dialog) => void;
}) {
  return (
    <>
      <div className="section-note">
        <Calculator size={20} />
        <p>
          <strong>Costo directo por concepto.</strong> Esta versión calcula la suma de insumos ×
          cantidades. Los cambios aprobados se muestran por separado de la línea base. Indirectos e
          impuestos siguen pendientes.
        </p>
      </div>
      {projects.map((p) => (
        <section className="panel budget-panel" key={p.id}>
          <div className="panel-head">
            <div>
              <span className="eyebrow">{p.code}</span>
              <h2>{p.name}</h2>
            </div>
            <div className="heading-actions">
              {p.budgetApproved ? (
                <span className="locked">
                  <LockKeyhole size={14} />
                  Línea base aprobada
                </span>
              ) : (
                <button
                  disabled={!can('approveBudget') || !p.budgetItems.length || p.status === 'CLOSED'}
                  className="secondary"
                  onClick={() =>
                    openDialog({
                      type: 'confirm',
                      item: {
                        path: `projects/${p.id}/approve-budget`,
                        title: 'Aprobar presupuesto',
                        message:
                          'El presupuesto quedará congelado. Los ajustes posteriores se tramitan desde Cambios de obra, conservando esta línea base.',
                      },
                    })
                  }
                >
                  <Check size={15} />
                  Aprobar presupuesto
                </button>
              )}
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Clave / concepto</th>
                  <th>Unidad</th>
                  <th className="numeric">Cantidad</th>
                  <th className="numeric">Precio unitario</th>
                  <th className="numeric">Importe</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {p.budgetItems.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <small>{i.code}</small>
                      <strong>{i.name}</strong>
                    </td>
                    <td>{i.unit}</td>
                    <td className="numeric">{qty(i.quantity)}</td>
                    <td className="numeric">{money(i.unitPrice)}</td>
                    <td className="numeric strong">
                      {money(Number(i.quantity) * Number(i.unitPrice))}
                    </td>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => openDialog({ type: 'apu', item: i })}
                      >
                        Ver análisis
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!p.budgetItems.length && (
            <Empty
              title="Presupuesto por construir"
              description="Agrega el primer concepto con sus insumos."
            />
          )}
          <div className="table-total">
            <span>{p.budgetItems.length} conceptos · MXN</span>
            <strong>
              Total directo <b>{money(sumBudget(p))}</b>
            </strong>
          </div>
          <BudgetAdjustment project={p} />
        </section>
      ))}
    </>
  );
}
