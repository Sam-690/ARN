'use client';
import { Check, X } from 'lucide-react';
import { FormEvent, useRef, useState } from 'react';
import { useCan } from '../../access';
import type { Drawing, DrawingVersion, PlanIssue } from '../../types';
import {
  actionLabel,
  Field,
  fileData,
  priorityLabel,
  Save,
  statusLabel,
  timestamp,
  today,
} from './helpers';
export function IssueDetail({
  issue,
  version,
  drawing,
  busy,
  save,
  setBusy,
  onClose,
}: {
  issue: PlanIssue;
  version: DrawingVersion;
  drawing: Drawing;
  busy: boolean;
  save: Save;
  setBusy: (v: boolean) => void;
  onClose: () => void;
}) {
  const [action, setAction] = useState('COMMENT'),
    [files, setFiles] = useState<File[]>([]),
    [localError, setLocalError] = useState('');
  const form = useRef<HTMLFormElement>(null);
  const can = useCan();
  const writable = can('plans') && drawing.project.status === 'ACTIVE';
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fields = Object.fromEntries(new FormData(e.currentTarget));
    setLocalError('');
    setBusy(true);
    try {
      if (
        files.length > 3 ||
        files.some((f) => !f.size || f.size > 8 * 1024 * 1024) ||
        files.reduce((n, f) => n + f.size, 0) > 12 * 1024 * 1024
      )
        throw new Error('Máximo 3 fotos: 8 MB cada una y 12 MB en total.');
      if (action === 'RESOLVE' && !files.length)
        throw new Error('Adjunta al menos una foto para respaldar la resolución.');
      const evidence = await Promise.all(
        files.map(async (f) => ({ name: f.name, mime: f.type, base64: await fileData(f) })),
      );
      if (
        await save(
          'plan-issues/' + issue.id + '/events',
          { ...fields, action, expectedRevision: issue.revision, evidence },
          'Seguimiento guardado',
        )
      ) {
        setAction('COMMENT');
        setFiles([]);
        form.current?.reset();
      }
    } catch (e) {
      setLocalError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel issue-detail">
      <div className="panel-head">
        <div>
          <span className="eyebrow">
            INC-{issue.number} · {drawing.code} · v{version.number} · PÁG. {issue.page}
          </span>
          <h2>{issue.title}</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Cerrar detalle de incidencia"
          disabled={busy}
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      <div className="issue-tags">
        <span className={'issue-status ' + issue.status}>{statusLabel[issue.status]}</span>
        <span>Prioridad {priorityLabel[issue.priority].toLowerCase()}</span>
        {issue.status !== 'RESOLVED' && issue.dueDate.slice(0, 10) < today() && (
          <span className="overdue">Vencida</span>
        )}
      </div>
      <p className="preserve">{issue.description}</p>
      <div className="log-facts">
        <span>Responsable: {issue.assignee}</span>
        <span>Vence: {issue.dueDate.slice(0, 10)}</span>
      </div>
      <h3>Historial de seguimiento</h3>
      <div className="issue-history">
        {issue.events.map((event) => (
          <article key={event.id}>
            <strong>{actionLabel[event.action]}</strong>
            <small>
              {event.author} · {timestamp(event.createdAt)}
            </small>
            <p className="preserve">{event.note}</p>
            {event.action === 'ASSIGN' && (
              <p>
                {event.assignee} · vence {event.dueDate.slice(0, 10)}
              </p>
            )}
            {event.evidence.length > 0 && (
              <div className="issue-photos">
                {event.evidence.map((f) => (
                  <a
                    key={f.id}
                    href={`/api/plan-issues/${issue.id}/evidence/${f.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <img
                      src={`/api/plan-issues/${issue.id}/evidence/${f.id}`}
                      alt={'Evidencia: ' + f.name}
                      loading="lazy"
                    />
                    <span>{f.name}</span>
                  </a>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
      {writable && (
        <form ref={form} className="log-section" onSubmit={submit}>
          <h3>Registrar seguimiento</h3>
          <fieldset disabled={busy}>
            <Field label="Acción de seguimiento">
              <select value={action} onChange={(e) => setAction(e.target.value)}>
                <option value="COMMENT">Añadir comentario</option>
                {issue.status === 'OPEN' && <option value="START">Iniciar atención</option>}
                {issue.status !== 'RESOLVED' ? (
                  <>
                    <option value="RESOLVE">Resolver con evidencia</option>
                    <option value="ASSIGN">Cambiar responsable / fecha</option>
                  </>
                ) : (
                  <option value="REOPEN">Reabrir incidencia</option>
                )}
              </select>
            </Field>
            {action === 'ASSIGN' && (
              <div className="form-grid">
                <Field label="Nuevo responsable">
                  <input name="assignee" defaultValue={issue.assignee} required maxLength={200} />
                </Field>
                <Field label="Nuevo vencimiento">
                  <input
                    name="dueDate"
                    type="date"
                    defaultValue={issue.dueDate.slice(0, 10)}
                    required
                  />
                </Field>
              </div>
            )}
            <Field
              label={action === 'RESOLVE' ? 'Explicación de la resolución' : 'Comentario o motivo'}
            >
              <textarea name="note" required maxLength={5000} rows={3} />
            </Field>
            <Field
              label={
                action === 'RESOLVE'
                  ? 'Fotos de resolución (obligatorias)'
                  : 'Fotos de seguimiento (opcional)'
              }
            >
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                required={action === 'RESOLVE'}
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
              />
            </Field>
            <p className="small-note">
              Hasta 3 fotos · 8 MB por foto · 12 MB por actualización. Cada registro conserva autor,
              fecha y evidencia.
            </p>
            {localError && (
              <p className="error" role="alert">
                {localError}
              </p>
            )}
            <button className="primary">
              <Check size={15} />
              {busy ? 'Guardando…' : 'Guardar seguimiento'}
            </button>
          </fieldset>
        </form>
      )}
    </section>
  );
}
