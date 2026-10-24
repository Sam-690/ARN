'use client';
import { Check, LoaderCircle } from 'lucide-react';
import { type FormEvent } from 'react';
import type { Data } from '../../types';
import { Dialog, Field, money, qty, today } from './helpers';
export function SupplyDialog({
  dialog,
  data,
  projectId,
  busy,
  error,
  mutate,
  close,
}: {
  dialog: Dialog;
  data: Data;
  projectId: string;
  busy: boolean;
  error: string;
  mutate: (path: string, body: unknown, message: string) => Promise<boolean>;
  close: () => void;
}) {
  const { type, item } = dialog;
  const active = data.projects.filter((p) => p.status === 'ACTIVE');
  const destinations = active.filter((p) => p.id !== item?.projectId);
  const titles: Record<string, string> = {
    need: 'Planificar material',
    cancelNeed: 'Cancelar necesidad',
    release: 'Declarar sobrante',
    transfer: 'Despachar traspaso',
    receiveTransfer: 'Recibir traspaso',
  };
  const descriptions: Record<string, string> = {
    need: 'Registra la cantidad y cuándo la necesitarás. El sistema calculará su cobertura.',
    cancelNeed:
      'El consumo ya registrado se conserva. Se cancela únicamente la necesidad restante.',
    release:
      'Esta cantidad quedará disponible para otras obras y separada del consumo local. Usa cero para retirar la liberación.',
    transfer:
      'Confirma este registro cuando el material salga de la obra. Permanecerá en tránsito hasta su recepción.',
    receiveTransfer:
      'Confirma solo cuando el material completo haya llegado y se haya verificado. La cantidad se incorporará al almacén de destino.',
  };
  const actions = (label: string, disabled = false) => (
    <div className="dialog-actions">
      <button type="button" className="secondary" disabled={busy} onClick={close}>
        Cancelar
      </button>
      <button className="primary" disabled={busy || disabled} type="submit">
        {busy ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />} {label}
      </button>
    </div>
  );
  const values = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    return Object.fromEntries(new FormData(e.currentTarget));
  };
  const errors = error && (
    <div className="error" role="alert">
      {error}
    </div>
  );
  return (
    <>
      <span className="eyebrow">ABASTECIMIENTO / REGISTRO</span>
      <h2>{titles[type]}</h2>
      <p className="dialog-sub">{descriptions[type]}</p>
      {type === 'need' && (
        <form onSubmit={(e) => mutate('supply/needs', values(e), 'Necesidad planificada')}>
          <Field label="Obra">
            <select
              name="projectId"
              defaultValue={
                active.some((p) => p.id === projectId) ? projectId : active[0]?.id || ''
              }
              required
            >
              {!active.length && <option value="">No hay obras activas</option>}
              {active.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Material">
            <select name="materialId" required>
              {!data.materials.some((m) => m.type === 'MATERIAL') && (
                <option value="">Agrega un material al catálogo</option>
              )}
              {data.materials
                .filter((m) => m.type === 'MATERIAL')
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.unit})
                  </option>
                ))}
            </select>
          </Field>
          <div className="form-grid">
            <Field label="Cantidad necesaria">
              <input
                name="quantity"
                type="number"
                min="0.0001"
                max="100000000"
                step="0.0001"
                required
              />
            </Field>
            <Field label="Fecha de necesidad">
              <input name="neededOn" type="date" defaultValue={today()} required />
            </Field>
            <Field label="Plazo de suministro (días naturales)">
              <input
                name="leadDays"
                type="number"
                min="0"
                max="365"
                step="1"
                defaultValue="5"
                required
              />
            </Field>
          </div>
          <Field label="Frente o actividad">
            <input
              name="purpose"
              placeholder="Ej. Cimentación del edificio A"
              required
              maxLength={200}
            />
          </Field>
          {errors}
          {actions(
            'Planificar',
            !active.length || !data.materials.some((m) => m.type === 'MATERIAL'),
          )}
        </form>
      )}
      {type === 'cancelNeed' && (
        <form
          onSubmit={(e) =>
            mutate(`supply/needs/${item.id}/cancel`, values(e), 'Necesidad cancelada')
          }
        >
          <div className="detail-box">
            <strong>{item.material.name}</strong>
            <p>
              {item.project.name} · {item.purpose}
            </p>
          </div>
          <Field label="Motivo">
            <input name="reason" required maxLength={200} />
          </Field>
          {errors}
          {actions('Confirmar cancelación')}
        </form>
      )}
      {type === 'release' && (
        <form
          onSubmit={(e) =>
            mutate(
              'stock/release',
              { ...values(e), projectId: item.projectId, materialId: item.materialId },
              'Sobrante actualizado',
            )
          }
        >
          <div className="detail-box">
            <strong>{item.material.name}</strong>
            <p>
              {item.project.name} · Existencia: {qty(item.quantity)} {item.material.unit}
            </p>
          </div>
          <Field label={`Total a liberar (${item.material.unit})`}>
            <input
              name="quantity"
              type="number"
              min="0"
              max={item.quantity}
              step="0.0001"
              defaultValue={item.released}
              required
            />
          </Field>
          <Field label="Motivo">
            <input
              name="reason"
              maxLength={200}
              placeholder="Ej. Material restante de losa terminada"
              required
            />
          </Field>
          {errors}
          {actions('Guardar sobrante')}
        </form>
      )}
      {type === 'transfer' && (
        <form
          onSubmit={(e) =>
            mutate(
              'stock/transfers',
              { ...values(e), fromProjectId: item.projectId, materialId: item.materialId },
              'Traspaso despachado; pendiente de recepción',
            )
          }
        >
          <div className="detail-box">
            <strong>{item.material.name}</strong>
            <p>
              Origen: {item.project.name}
              <br />
              Liberado: {qty(item.released)} {item.material.unit}
              <br />
              Costo de salida: {money(item.averageCost)} por {item.material.unit}
            </p>
          </div>
          <Field label="Obra de destino">
            <select
              name="toProjectId"
              defaultValue={
                destinations.some((p) => p.id === item.toProjectId)
                  ? item.toProjectId
                  : destinations[0]?.id || ''
              }
              required
            >
              {!destinations.length && <option value="">No hay otra obra activa</option>}
              {destinations.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={`Cantidad a despachar (${item.material.unit})`}>
            <input
              name="quantity"
              type="number"
              min="0.0001"
              step="0.0001"
              max={item.released}
              defaultValue={item.suggestedQuantity || item.released}
              required
            />
          </Field>
          <Field label="Folio de salida / responsable del traslado">
            <input name="reference" maxLength={200} required />
          </Field>
          <p className="small-note">
            Sin flete capitalizado. La recepción se confirma por el total despachado; si hay
            diferencias, conserva el traspaso en tránsito para aclararlas.
          </p>
          {errors}
          {actions('Confirmar despacho', !destinations.length || Number(item.released) <= 0)}
        </form>
      )}
      {type === 'receiveTransfer' && (
        <form
          onSubmit={(e) =>
            mutate(
              `stock/transfers/${item.id}/receive`,
              values(e),
              'Traspaso recibido; almacén actualizado',
            )
          }
        >
          <div className="detail-box">
            <strong>
              TR-{item.number} · {item.material.name}
            </strong>
            <p>
              {item.fromProject.name} → {item.toProject.name}
              <br />
              {qty(item.quantity)} {item.material.unit}
            </p>
          </div>
          <Field label="Folio de recepción / evidencia de entrega">
            <input name="reference" required maxLength={200} />
          </Field>
          {errors}
          {actions('Confirmar recepción completa')}
        </form>
      )}
    </>
  );
}
