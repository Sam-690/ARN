'use client';
import { FormEvent } from 'react';
import { Field } from '../../shared/presentation';
export function MaterialForm({
  mutate,
  values,
  errors,
  actions,
}: {
  mutate: (path: string, body: unknown, message: string) => Promise<boolean>;
  values: (e: FormEvent<HTMLFormElement>) => { [k: string]: FormDataEntryValue };
  errors: React.JSX.Element | null;
  actions: (label?: string, disabled?: boolean) => React.JSX.Element;
}) {
  return (
    <form onSubmit={(e) => mutate('materials', values(e), 'Insumo agregado al catálogo')}>
      <div className="form-grid">
        <Field label="Clave">
          <input name="code" required maxLength={24} />
        </Field>
        <Field label="Tipo">
          <select name="type">
            <option value="MATERIAL">Material</option>
            <option value="LABOR">Mano de obra</option>
            <option value="EQUIPMENT">Equipo</option>
          </select>
        </Field>
        <Field label="Descripción">
          <input name="name" required maxLength={200} />
        </Field>
        <Field label="Unidad">
          <input name="unit" placeholder="m², bulto, jor…" required maxLength={16} />
        </Field>
        <Field label="Precio de referencia (MXN)">
          <input name="price" type="number" min="0.0001" step="0.0001" max="100000000" required />
        </Field>
      </div>
      {errors}
      {actions('Agregar insumo')}
    </form>
  );
}
