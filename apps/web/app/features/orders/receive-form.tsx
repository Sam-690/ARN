'use client';
import { FormEvent } from 'react';
import { Field, qty } from '../../shared/presentation';
import type { Order } from '../../types';
export function ReceiveForm({
  item,
  receiveLine,
  mutate,
  values,
  setReceiveLine,
  errors,
  actions,
}: {
  item: any;
  receiveLine: string;
  mutate: (path: string, body: unknown, message: string) => Promise<boolean>;
  values: (e: FormEvent<HTMLFormElement>) => { [k: string]: FormDataEntryValue };
  setReceiveLine: React.Dispatch<React.SetStateAction<string>>;
  errors: React.JSX.Element | null;
  actions: (label?: string, disabled?: boolean) => React.JSX.Element;
}) {
  return (() => {
    const pending = (item as Order).lines.filter((l) => Number(l.received) < Number(l.quantity));
    const l = pending.find((x) => x.id === receiveLine) || pending[0];
    return (
      <form
        onSubmit={(e) =>
          mutate(
            `orders/${item.id}/receive`,
            values(e),
            'Recepción registrada; almacén actualizado',
          )
        }
      >
        <Field label="Partida">
          <select
            name="lineId"
            value={l?.id || ''}
            onChange={(e) => setReceiveLine(e.target.value)}
            required
          >
            {pending.map((x) => (
              <option value={x.id} key={x.id}>
                {x.material.name} · Pendiente: {qty(Number(x.quantity) - Number(x.received))}{' '}
                {x.material.unit}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Cantidad recibida">
          <input
            key={l?.id}
            name="quantity"
            type="number"
            min="0.0001"
            step="0.0001"
            max={l ? Number(l.quantity) - Number(l.received) : 0}
            defaultValue={l ? Number(l.quantity) - Number(l.received) : 0}
            required
          />
        </Field>
        <Field label="Referencia de entrega">
          <input
            name="reference"
            required
            maxLength={200}
            placeholder="Remisión o nota de entrega"
          />
        </Field>
        {errors}
        {actions('Confirmar recepción')}
      </form>
    );
  })();
}
