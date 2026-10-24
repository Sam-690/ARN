'use client';
import { Plus, X } from 'lucide-react';
import { FormEvent } from 'react';
import type { Data } from '../../types';
import { Field, proposalValues, Save } from './helpers';
import { ProposalFields } from './proposal-fields';
export function CreateChange({
  data,
  projectId,
  busy,
  save,
  onDone,
  onCancel,
}: {
  data: Data;
  projectId: string;
  busy: boolean;
  save: Save;
  onDone: () => void;
  onCancel: () => void;
}) {
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.currentTarget));
    if (
      await save(
        'changes',
        { projectId: v.projectId, title: v.title, reason: v.reason, proposal: proposalValues(v) },
        'Solicitud guardada en borrador',
      )
    )
      onDone();
  }
  return (
    <form className="panel change-form" onSubmit={submit}>
      <div className="panel-head">
        <div>
          <h2>Nueva solicitud de cambio</h2>
          <p>La propuesta no modifica la línea base ni el plazo hasta aprobarse.</p>
        </div>
        <button
          className="icon-button"
          type="button"
          aria-label="Cancelar solicitud nueva"
          disabled={busy}
          onClick={onCancel}
        >
          <X size={18} />
        </button>
      </div>
      <fieldset disabled={busy}>
        <Field label="Obra del cambio">
          <select
            name="projectId"
            required
            defaultValue={
              projectId === 'all' ? data.projects.find((p) => p.status === 'ACTIVE')?.id : projectId
            }
          >
            {data.projects
              .filter((p) => p.status === 'ACTIVE' && (projectId === 'all' || p.id === projectId))
              .map((p) => (
                <option value={p.id} key={p.id}>
                  {p.code} · {p.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Título del cambio">
          <input
            name="title"
            required
            maxLength={200}
            placeholder="Ej. Ampliación de acceso norte"
          />
        </Field>
        <Field label="Motivo de la solicitud">
          <textarea name="reason" rows={2} required maxLength={5000} />
        </Field>
        <ProposalFields />
        <div className="log-actions">
          <button type="button" className="secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button className="primary">
            <Plus size={15} />
            Guardar solicitud
          </button>
        </div>
      </fieldset>
    </form>
  );
}
