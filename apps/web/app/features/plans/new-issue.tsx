'use client';
import { MapPin } from 'lucide-react';
import { FormEvent } from 'react';
import type { Drawing, DrawingVersion } from '../../types';
import { Field, Save, today } from './helpers';
export function NewIssue({
  drawing,
  version,
  page,
  point,
  busy,
  save,
  onDone,
  onCancel,
}: {
  drawing: Drawing;
  version: DrawingVersion;
  page: number;
  point: { x: number; y: number };
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
        `drawings/${drawing.id}/versions/${version.id}/issues`,
        { ...v, page, x: Number(v.x) / 100, y: Number(v.y) / 100 },
        'Incidencia ubicada en el plano',
      )
    )
      onDone();
  }
  return (
    <form className="panel plan-form" onSubmit={submit}>
      <h3>
        Nueva incidencia · v{version.number} · página {page}
      </h3>
      <p className="small-note">
        {drawing.project.name} · {drawing.code} · {version.label}
      </p>
      <fieldset disabled={busy}>
        <Field label="Título de la incidencia">
          <input
            name="title"
            required
            maxLength={200}
            placeholder="Ej. Revisar paso de instalación"
          />
        </Field>
        <Field label="Descripción del pendiente">
          <textarea name="description" rows={3} required maxLength={5000} />
        </Field>
        <div className="form-grid">
          <Field label="Responsable">
            <input name="assignee" required maxLength={200} placeholder="Nombre del responsable" />
          </Field>
          <Field label="Vencimiento">
            <input name="dueDate" type="date" defaultValue={today()} required />
          </Field>
          <Field label="Prioridad">
            <select name="priority" defaultValue="NORMAL">
              <option value="LOW">Baja</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">Alta</option>
            </select>
          </Field>
        </div>
        <div className="form-grid">
          <Field label="Ubicación horizontal (%)">
            <input
              name="x"
              type="number"
              min="0"
              max="100"
              step="any"
              defaultValue={+(point.x * 100).toFixed(3)}
              required
            />
          </Field>
          <Field label="Ubicación vertical (%)">
            <input
              name="y"
              type="number"
              min="0"
              max="100"
              step="any"
              defaultValue={+(point.y * 100).toFixed(3)}
              required
            />
          </Field>
        </div>
        <p className="small-note">
          Ubicación desde la esquina superior izquierda de esta página. El responsable se registra
          por nombre; aún no se envían notificaciones.
        </p>
        <div className="log-actions">
          <button type="button" className="secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button className="primary">
            <MapPin size={15} />
            Guardar incidencia
          </button>
        </div>
      </fieldset>
    </form>
  );
}
