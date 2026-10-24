'use client';
import { FormEvent } from 'react';
import { Field, qty } from '../../shared/presentation';
import type { Data } from '../../types';
export function ConsumeForm({
  values,
  mutate,
  item,
  data,
  errors,
  actions,
}: {
  values: (e: FormEvent<HTMLFormElement>) => { [k: string]: FormDataEntryValue };
  mutate: (path: string, body: unknown, message: string) => Promise<boolean>;
  item: any;
  data: Data;
  errors: React.JSX.Element | null;
  actions: (label?: string, disabled?: boolean) => React.JSX.Element;
}) {
  return (
    <form
      onSubmit={(e) => {
        const v = values(e);
        mutate(
          'stock/consume',
          {
            ...v,
            needId: v.needId || undefined,
            projectId: item.projectId,
            materialId: item.materialId,
          },
          'Salida de material registrada',
        );
      }}
    >
      <div className="detail-box">
        <strong>{item.material.name}</strong>
        <p>
          {item.project.name} · Utilizable: {qty(Number(item.quantity) - Number(item.released))}{' '}
          {item.material.unit}
        </p>
      </div>
      <Field label={`Cantidad a utilizar (${item.material.unit})`}>
        <input
          name="quantity"
          type="number"
          min="0.0001"
          step="0.0001"
          max={Number(item.quantity) - Number(item.released)}
          required
        />
      </Field>
      <Field label="Necesidad que atiende">
        <select name="needId" defaultValue={item.needId || ''}>
          <option value="">Consumo sin necesidad planificada</option>
          {data.needs
            .filter(
              (n) =>
                n.status === 'OPEN' &&
                n.projectId === item.projectId &&
                n.materialId === item.materialId,
            )
            .map((n) => (
              <option key={n.id} value={n.id}>
                {n.purpose} · Pendiente: {qty(Number(n.quantity) - Number(n.consumed))}
              </option>
            ))}
        </select>
      </Field>
      <Field label="Destino / referencia de los trabajos">
        <input name="reference" required maxLength={200} placeholder="Ej. Cimentación, frente A" />
      </Field>
      {errors}
      {actions('Confirmar salida')}
    </form>
  );
}
