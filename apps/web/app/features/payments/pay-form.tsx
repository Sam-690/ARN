'use client';
import { FormEvent } from 'react';
import { Field, money, today } from '../../shared/presentation';
export function PayForm({
  mutate,
  item,
  values,
  errors,
  actions,
}: {
  mutate: (path: string, body: unknown, message: string) => Promise<boolean>;
  item: any;
  values: (e: FormEvent<HTMLFormElement>) => { [k: string]: FormDataEntryValue };
  errors: React.JSX.Element | null;
  actions: (label?: string, disabled?: boolean) => React.JSX.Element;
}) {
  return (
    <form
      onSubmit={(e) => mutate(`orders/${item.id}/pay`, values(e), 'Pago registrado correctamente')}
    >
      <div className="detail-box">
        <strong>{item.supplier}</strong>
        <p>
          OC-{item.number} · {item.project.name}
        </p>
        <span>
          Saldo recibido por pagar: <b>{money(item.due)}</b>
        </span>
      </div>
      <div className="form-grid">
        <Field label="Importe pagado (MXN)">
          <input name="amount" type="number" min="0.01" step="0.01" max={item.due} required />
        </Field>
        <Field label="Fecha del pago">
          <input name="paidAt" type="date" defaultValue={today()} required />
        </Field>
        <Field label="Método">
          <select name="method">
            <option>Transferencia</option>
            <option>Efectivo</option>
            <option>Cheque</option>
          </select>
        </Field>
        <Field label="Referencia / folio">
          <input name="reference" required maxLength={200} />
        </Field>
      </div>
      <p className="small-note">
        Esta acción solo registra el pago. No mueve dinero ni envía instrucciones a un banco.
      </p>
      {errors}
      {actions('Guardar pago')}
    </form>
  );
}
