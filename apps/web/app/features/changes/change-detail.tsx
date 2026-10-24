'use client';
import { Check, History, LockKeyhole } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { useCan } from '../../access';
import type { ChangeRequest } from '../../types';
import {
  actionLabels,
  changeLabels,
  day,
  Field,
  money,
  proposalValues,
  Save,
  time,
  today,
} from './helpers';
import { ProposalFields } from './proposal-fields';
export function ChangeDetail({
  change: c,
  busy,
  save,
}: {
  change: ChangeRequest;
  busy: boolean;
  save: Save;
}) {
  const can = useCan();
  const [action, setAction] = useState(''),
    p = c.proposals[0],
    active = c.project.status === 'ACTIVE',
    credit = c.settlementKind === 'CREDIT';
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.currentTarget));
    const body = {
      action,
      expectedRevision: c.revision,
      note: v.note,
      ...(action === 'REVISE' ? { proposal: proposalValues(v) } : {}),
      ...(action === 'PROGRESS' ? { progress: Number(v.progress) } : {}),
      ...(action === 'APPROVE'
        ? { authorizationBy: v.authorizationBy, authorizationReference: v.authorizationReference }
        : {}),
      ...(action === 'SETTLEMENT'
        ? { amount: v.amount, date: v.date, reference: v.reference }
        : {}),
    };
    if (await save('changes/' + c.id + '/actions', body, 'Seguimiento del cambio guardado'))
      setAction('');
  }
  const permittedActions =
    c.status === 'DRAFT'
      ? ['REVISE', 'SUBMIT', 'CANCEL']
      : c.status === 'SUBMITTED'
        ? ['APPROVE', 'REJECT', 'CANCEL']
        : c.status === 'REJECTED'
          ? ['REVISE', 'CANCEL']
          : c.status === 'APPROVED'
            ? ['PROGRESS', ...(Number(c.outstanding) > 0 ? ['SETTLEMENT'] : [])]
            : [];
  const allowed = permittedActions.filter((a) =>
    can(
      a === 'SETTLEMENT'
        ? 'payments'
        : ['APPROVE', 'REJECT'].includes(a)
          ? 'approveChange'
          : 'changes',
    ),
  );
  const buttons: Record<string, string> = {
    REVISE: 'Crear revisión',
    SUBMIT: 'Enviar a autorización',
    APPROVE: 'Registrar aprobación',
    REJECT: 'Rechazar propuesta',
    CANCEL: 'Cancelar solicitud',
    PROGRESS: 'Registrar avance',
    SETTLEMENT: credit ? 'Registrar crédito aplicado' : 'Registrar cobro',
  };
  return (
    <section className="panel change-detail">
      <span className="eyebrow">
        {c.project.code} · CAM-{c.number} · REVISIÓN {p.number}
      </span>
      <div className="change-detail-heading">
        <h2>{c.title}</h2>
        <span className={'change-status ' + c.status}>{changeLabels[c.status]}</span>
      </div>
      <p className="small-note">
        {c.project.name} · Solicitó {c.author} · {time(c.createdAt)}
      </p>
      <h3>Motivo</h3>
      <p className="preserve">{c.reason}</p>
      <h3>Propuesta vigente</h3>
      <p className="preserve">{p.scope}</p>
      <div className="change-amounts">
        <div>
          <span>Variación de costo directo</span>
          <strong>{money(p.costDelta)}</strong>
        </div>
        <div>
          <span>Variación al cliente</span>
          <strong>{money(p.priceDelta)}</strong>
        </div>
        <div>
          <span>Impacto en plazo</span>
          <strong>
            {p.daysDelta > 0 ? '+' : ''}
            {p.daysDelta} días
          </strong>
        </div>
      </div>
      {c.status === 'APPROVED' ? (
        <>
          <div className="change-notice">
            <LockKeyhole size={16} />
            <p>
              Revisión aprobada y fija. Una modificación posterior requiere otra solicitud de
              cambio.
            </p>
          </div>
          <div className="change-amounts">
            <div>
              <span>Avance de ejecución</span>
              <strong>{c.progress}%</strong>
            </div>
            <div>
              <span>{credit ? 'Crédito aplicado' : 'Cobrado'}</span>
              <strong>{money(c.applied)}</strong>
            </div>
            <div>
              <span>{credit ? 'Crédito pendiente' : 'Por cobrar'}</span>
              <strong>{money(c.outstanding)}</strong>
            </div>
          </div>
          <div className="progress">
            <i style={{ width: c.progress + '%' }} />
          </div>
        </>
      ) : (
        <p className="small-note">Esta propuesta no afecta los totales aprobados de la obra.</p>
      )}
      {active && allowed.length > 0 && (
        <div className="change-action-buttons">
          {allowed.map((a) => (
            <button
              key={a}
              className={action === a ? 'primary' : 'secondary'}
              disabled={busy}
              onClick={() => setAction(action === a ? '' : a)}
            >
              {buttons[a]}
            </button>
          ))}
        </div>
      )}
      {action && (
        <form className="change-action-form" onSubmit={submit}>
          <h3>{buttons[action]}</h3>
          <fieldset disabled={busy}>
            {action === 'REVISE' && <ProposalFields proposal={p} />}
            {action === 'APPROVE' && (
              <>
                <div className="change-notice">
                  <p>
                    Se autoriza la revisión {p.number}: {money(p.costDelta)} de costo directo,{' '}
                    {money(p.priceDelta)} al cliente y {p.daysDelta} días. Se requiere una línea
                    base de presupuesto aprobada.
                  </p>
                </div>
                <Field label="Persona que autorizó">
                  <input
                    name="authorizationBy"
                    required
                    maxLength={200}
                    placeholder="Nombre de quien emitió la autorización"
                  />
                </Field>
                <Field label="Referencia de autorización">
                  <input
                    name="authorizationReference"
                    required
                    maxLength={200}
                    placeholder="Ej. convenio, folio o correo de autorización"
                  />
                </Field>
                <p className="small-note">
                  Registro interno de una autorización obtenida fuera de la aplicación. No envía
                  documentos ni solicita firmas al cliente.
                </p>
              </>
            )}
            {action === 'SUBMIT' && (
              <p className="small-note">
                La revisión {p.number} quedará pendiente de decisión. Si necesita ajustes, recházala
                con motivo y crea una nueva revisión.
              </p>
            )}
            {action === 'PROGRESS' && (
              <Field label="Avance ejecutado (%)">
                <input
                  name="progress"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  required
                  defaultValue={c.progress}
                />
              </Field>
            )}
            {action === 'SETTLEMENT' && (
              <>
                <Field
                  label={credit ? 'Importe del crédito aplicado (MXN)' : 'Importe cobrado (MXN)'}
                >
                  <input
                    name="amount"
                    type="number"
                    min=".01"
                    max={c.outstanding}
                    step=".01"
                    required
                  />
                </Field>
                <div className="form-grid">
                  <Field label="Fecha del movimiento">
                    <input name="date" type="date" defaultValue={today()} required />
                  </Field>
                  <Field label="Referencia única del movimiento">
                    <input name="reference" required maxLength={200} />
                  </Field>
                </div>
                <p className="small-note">
                  Registra un movimiento ya realizado o un crédito ya aplicado. Esta acción no mueve
                  dinero, emite facturas ni modifica pagos a proveedores.
                </p>
              </>
            )}
            <Field
              label={
                action === 'PROGRESS'
                  ? 'Descripción del avance o corrección'
                  : 'Motivo / observaciones'
              }
            >
              <textarea name="note" required rows={3} maxLength={5000} />
            </Field>
            <div className="log-actions">
              <button type="button" className="secondary" onClick={() => setAction('')}>
                Volver
              </button>
              <button className="primary">
                <Check size={15} />
                Confirmar {buttons[action].toLowerCase()}
              </button>
            </div>
          </fieldset>
        </form>
      )}
      <details className="change-history">
        <summary>
          <History size={16} />
          Revisiones conservadas ({c.proposals.length})
        </summary>
        {c.proposals.map((v) => (
          <article key={v.id}>
            <strong>
              Revisión {v.number}
              {v.id === p.id ? ' · vigente' : ''}
            </strong>
            <small>
              {v.author} · {time(v.createdAt)}
            </small>
            <p className="preserve">{v.scope}</p>
            <p>
              Costo: {money(v.costDelta)} · Cliente: {money(v.priceDelta)} · Plazo: {v.daysDelta}{' '}
              días
            </p>
          </article>
        ))}
      </details>
      <h3>Historial de decisiones y avance</h3>
      <div className="issue-history">
        {c.events.map((e) => (
          <article key={e.id}>
            <strong>
              {actionLabels[e.action]} · revisión {e.proposalNumber}
            </strong>
            <small>
              Registró {e.actor} · {time(e.createdAt)}
            </small>
            <p className="preserve">{e.note}</p>
            {e.authorizationBy && (
              <p>
                Autorizó: {e.authorizationBy} · Referencia: {e.authorizationReference}
              </p>
            )}
            {e.progress !== null && <p>Avance registrado: {e.progress}%</p>}
          </article>
        ))}
      </div>
      {c.settlements.length > 0 && (
        <>
          <h3>{credit ? 'Créditos aplicados' : 'Cobros registrados'}</h3>
          <div className="issue-history">
            {c.settlements.map((s) => (
              <article key={s.id}>
                <strong>
                  {money(s.amount)} · {s.reference}
                </strong>
                <small>
                  {day(s.date)} · registró {s.actor}
                </small>
                <p className="preserve">{s.note}</p>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
