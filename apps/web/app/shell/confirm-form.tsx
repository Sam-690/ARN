'use client';
import { Check, LoaderCircle } from 'lucide-react';
export function ConfirmForm({
  item,
  errors,
  busy,
  close,
  mutate,
}: {
  item: any;
  errors: React.JSX.Element | null;
  busy: boolean;
  close: () => void;
  mutate: (path: string, body: unknown, message: string) => Promise<boolean>;
}) {
  return (
    <>
      <p className="confirm-message">{item.message}</p>
      {errors}
      <div className="dialog-actions">
        <button className="secondary" disabled={busy} onClick={close}>
          Volver
        </button>
        <button
          className="primary"
          disabled={busy}
          onClick={() => mutate(item.path, {}, 'Operación registrada')}
        >
          {busy ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}Confirmar
        </button>
      </div>
    </>
  );
}
