'use client';
import { useState } from 'react';
import { useCan } from '../../access';
import type { ExperienceRecord } from '../../types';
import { day, Field, localDay, money, qty, Save, statusLabels } from './helpers';
export function RecordDetail({
  record: r,
  busy,
  save,
}: {
  record: ExperienceRecord;
  busy: boolean;
  save: Save;
}) {
  const can = useCan();
  const [action, setAction] = useState('');
  return (
    <section className="panel experience-form">
      <span className="eyebrow">
        EXP-{r.number} · {r.isTest ? 'PRUEBA EXCLUIDA' : statusLabels[r.status]}
      </span>
      <h2>{r.budgetSnapshot.name}</h2>
      <p>
        {r.project.name} · {r.front} · {day(r.startDate)} a {day(r.endDate)}
      </p>
      <div className="mini-stats">
        <div>
          <span>Ejecutado en el periodo</span>
          <strong>
            {qty(r.quantity)} {r.family.unit}
          </strong>
        </div>
        <div>
          <span>
            {r.coverage === 'DIRECT_COMPLETE'
              ? 'Costo directo declarado'
              : 'Costo material asignado'}
          </span>
          <strong>{money(r.metrics.recordedCost)}</strong>
        </div>
        <div>
          <span>Costo registrado / {r.family.unit}</span>
          <strong>{money(r.metrics.unitCost)}</strong>
        </div>
      </div>
      {r.coverage === 'DIRECT_COMPLETE' ? (
        <div className="experience-notice">
          <p>
            Línea base para esta cantidad: {money(r.metrics.plannedCost)} · Variación:{' '}
            <strong>{money(r.metrics.variance || 0)}</strong>
          </p>
          <p>
            Mano de obra: {money(r.laborCost)} · Equipo: {money(r.equipmentCost)} · Otros:{' '}
            {money(r.otherCost)} · Material: {money(r.metrics.materialCost)}
          </p>
        </div>
      ) : (
        <p className="experience-notice">
          Cobertura parcial: solo materiales. No se compara este importe con el costo directo
          completo del presupuesto.
        </p>
      )}
      {r.laborHours && (
        <p>
          Horas-persona: {qty(r.laborHours)} · Productividad: {qty(r.metrics.productivity || 0)}{' '}
          {r.family.unit}/hora-persona
        </p>
      )}
      <h3>Fuentes y condiciones</h3>
      <p className="preserve">{r.note}</p>
      {r.costReference && <p className="preserve">Soporte: {r.costReference}</p>}
      <p className="small-note">
        {r.reference} · Registró {r.author} · {localDay(r.createdAt)}
      </p>
      <div className="experience-sources">
        {r.allocations.map((a) => (
          <article key={a.id}>
            <strong>{a.movement.material.name}</strong>
            <p>
              {qty(a.quantity)} {a.movement.material.unit} a {money(a.unitCost)} /{' '}
              {a.movement.material.unit}
            </p>
            <small>
              Salida {localDay(a.movement.createdAt)} · {a.movement.reference} · {a.movement.id}
            </small>
          </article>
        ))}
      </div>
      <details className="change-history">
        <summary>Línea base conservada · {r.budgetHash.slice(0, 12)}</summary>
        <p>
          {r.budgetSnapshot.code} · {r.budgetSnapshot.name} · {money(r.plannedUnitPrice)}/
          {r.budgetSnapshot.unit}
        </p>
        {r.budgetSnapshot.components.map((c, i) => (
          <p key={i}>
            {c.name}: {qty(c.quantity)} × {money(c.price)}
          </p>
        ))}
      </details>
      <h3>Grupo comparable</h3>
      <p>
        {r.family.code} · {r.family.name} · versión {r.family.version}
      </p>
      <p className="preserve">{r.family.method}</p>
      <p className="preserve">{r.family.conditions}</p>
      {r.isTest && (
        <p className="experience-notice">
          Registro de prueba: nunca entra en promedios ni rendimientos de la biblioteca.
        </p>
      )}
      {can('validateExperience') && r.project.status === 'ACTIVE' && r.status !== 'VOID' && (
        <>
          <div className="log-actions">
            {!r.isTest && (
              <button
                disabled={busy}
                className="secondary"
                onClick={() => setAction(r.status === 'VALIDATED' ? 'WITHDRAW' : 'VALIDATE')}
              >
                {r.status === 'VALIDATED'
                  ? 'Retirar de la biblioteca'
                  : 'Validar como muestra real'}
              </button>
            )}
            <button disabled={busy} className="secondary" onClick={() => setAction('VOID')}>
              Anular registro
            </button>
          </div>
          {action && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const v = new FormData(e.currentTarget);
                if (
                  await save(
                    `experience/records/${r.id}/actions`,
                    { action, expectedRevision: r.revision, note: v.get('note'), confirmed: true },
                    'Estado de experiencia actualizado',
                  )
                )
                  setAction('');
              }}
            >
              <fieldset disabled={busy}>
                <p className="experience-notice">
                  {action === 'VALIDATE'
                    ? 'Confirma que las fuentes son reales, la ejecución está completa para este periodo y el grupo describe el mismo método y condiciones. Se incluirá esta muestra en los promedios.'
                    : action === 'VOID'
                      ? 'Se excluirá el registro y se liberarán sus asignaciones. El historial se conserva; no se devuelve material al almacén. Para corregir, registra una nueva ejecución con otra referencia.'
                      : 'La muestra dejará de participar en promedios y conservará sus asignaciones.'}
                </p>
                <Field label="Motivo de validación o cambio">
                  <textarea name="note" required maxLength={2000} rows={2} />
                </Field>
                <label className="document-confirm">
                  <input type="checkbox" required />
                  Confirmo esta decisión y su motivo.
                </label>
                <button className="primary">
                  Confirmar{' '}
                  {action === 'VALIDATE'
                    ? 'validación'
                    : action === 'VOID'
                      ? 'anulación'
                      : 'retiro'}
                </button>
              </fieldset>
            </form>
          )}
        </>
      )}
      <details className="change-history">
        <summary>Historial ({r.events.length})</summary>
        {r.events.map((e) => (
          <article key={e.id}>
            <strong>
              {{
                CREATE: 'Registro creado',
                VALIDATE: 'Muestra validada',
                WITHDRAW: 'Retirada de promedios',
                VOID: 'Anulado',
              }[e.action] || e.action}
            </strong>
            <small>
              {e.actor} · {new Date(e.createdAt).toLocaleString('es-MX')}
            </small>
            <p>{e.note}</p>
          </article>
        ))}
      </details>
    </section>
  );
}
