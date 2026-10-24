'use client';
import { FormEvent } from 'react';
import { Field, today } from '../../shared/presentation';
import type { Data } from '../../types';
export function LogForm({
  values,
  mutate,
  projectSelect,
  chosen,
  data,
  errors,
  actions,
}: {
  values: (e: FormEvent<HTMLFormElement>) => { [k: string]: FormDataEntryValue };
  mutate: (path: string, body: unknown, message: string) => Promise<boolean>;
  projectSelect: React.JSX.Element;
  chosen: any;
  data: Data;
  errors: React.JSX.Element | null;
  actions: (label?: string, disabled?: boolean) => React.JSX.Element;
}) {
  return (
    <form
      onSubmit={(e) => {
        const v = values(e);
        mutate(
          'logs',
          { ...v, budgetItemId: v.budgetItemId || undefined },
          'Bitácora guardada; ya puedes adjuntar evidencia',
        );
      }}
    >
      {projectSelect}
      <div className="form-grid">
        <Field label="Fecha">
          <input name="date" type="date" defaultValue={today()} required />
        </Field>
        <Field label="Personal en obra">
          <input name="crew" type="number" min="0" max="10000" step="1" required defaultValue="0" />
        </Field>
      </div>
      <Field label="Frente de trabajo (opcional)">
        <input name="front" maxLength={200} placeholder="Ej. Edificio A · nivel 2" />
      </Field>
      <Field label="Concepto del presupuesto (opcional)">
        <select key={chosen} name="budgetItemId" defaultValue="">
          <option value="">Sin concepto asociado</option>
          {(data.projects.find((p) => p.id === chosen)?.budgetItems || []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.code} · {b.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Título del registro">
        <input name="title" placeholder="Ej. Colado de losa, edificio A" required maxLength={200} />
      </Field>
      <Field label="Actividades realizadas">
        <textarea
          name="activities"
          rows={4}
          required
          maxLength={10000}
          placeholder="Describe trabajos, avances y observaciones…"
        />
      </Field>
      <Field label="Incidencias o pendientes (opcional)">
        <textarea name="incident" rows={2} maxLength={5000} />
      </Field>
      <Field label="Condiciones del clima">
        <select name="weather">
          <option>Despejado</option>
          <option>Nublado</option>
          <option>Lluvia</option>
          <option>Sin registrar</option>
        </select>
      </Field>
      {errors}
      {actions('Guardar bitácora', !chosen)}
    </form>
  );
}
