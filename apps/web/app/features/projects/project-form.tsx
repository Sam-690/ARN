'use client';
import { FormEvent } from 'react';
import { Field, today } from '../../shared/presentation';
import type { Data } from '../../types';
export function ProjectForm({
  values,
  mutate,
  data,
  errors,
  actions,
}: {
  values: (e: FormEvent<HTMLFormElement>) => { [k: string]: FormDataEntryValue };
  mutate: (path: string, body: unknown, message: string) => Promise<boolean>;
  data: Data;
  errors: React.JSX.Element | null;
  actions: (label?: string, disabled?: boolean) => React.JSX.Element;
}) {
  return (
    <form
      onSubmit={(e) => {
        const v = values(e);
        mutate('projects', v, 'Obra creada correctamente');
      }}
    >
      <div className="form-grid">
        <Field label="Clave">
          <input name="code" placeholder="OB-004" maxLength={24} required />
        </Field>
        <Field label="Nombre de la obra">
          <input name="name" placeholder="Nombre del proyecto" maxLength={200} required />
        </Field>
        <Field label="Cliente">
          <input name="client" required maxLength={200} />
        </Field>
        <Field label="Responsable">
          <input name="manager" defaultValue={data.user.name} required maxLength={200} />
        </Field>
        <Field label="Ubicación">
          <input name="location" placeholder="Ciudad, estado" required maxLength={200} />
        </Field>
        <Field label="Fecha de inicio">
          <input name="startDate" type="date" defaultValue={today()} required />
        </Field>
        <Field label="Fecha de término">
          <input name="endDate" type="date" required />
        </Field>
      </div>
      {errors}
      {actions('Crear obra')}
    </form>
  );
}
