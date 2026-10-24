'use client';
import { Plus, Trash2 } from 'lucide-react';
import { FormEvent } from 'react';
import { Field, money, today } from '../../shared/presentation';
import type { Data } from '../../types';
export function OrderForm({
  mutate,
  values,
  orderLines,
  projectSelect,
  item,
  data,
  setOrderLines,
  errors,
  actions,
  chosen,
}: {
  mutate: (path: string, body: unknown, message: string) => Promise<boolean>;
  values: (e: FormEvent<HTMLFormElement>) => { [k: string]: FormDataEntryValue };
  orderLines: { materialId: any; quantity: any; unitPrice: number }[];
  projectSelect: React.JSX.Element;
  item: any;
  data: Data;
  setOrderLines: React.Dispatch<
    React.SetStateAction<{ materialId: any; quantity: any; unitPrice: number }[]>
  >;
  errors: React.JSX.Element | null;
  actions: (label?: string, disabled?: boolean) => React.JSX.Element;
  chosen: any;
}) {
  return (
    <form
      onSubmit={(e) =>
        mutate('orders', { ...values(e), lines: orderLines }, 'Orden guardada en borrador')
      }
    >
      {projectSelect}
      <div className="form-grid">
        <Field label="Proveedor">
          <input name="supplier" required maxLength={200} placeholder="Nombre o razón social" />
        </Field>
        <Field label="Entrega esperada">
          <input
            name="expectedDate"
            type="date"
            defaultValue={item?.expectedDate || today()}
            required
          />
        </Field>
      </div>
      <div className="form-section">
        <h3>Materiales de la orden</h3>
        {orderLines.map((l, i) => (
          <div className="component-row" key={i}>
            <Field label="Material">
              <select
                aria-label={`Material ${i + 1}`}
                required
                value={l.materialId}
                onChange={(e) => {
                  const m = data.materials.find((m) => m.id === e.target.value);
                  setOrderLines((prev) =>
                    prev.map((x, j) =>
                      i === j
                        ? { ...x, materialId: e.target.value, unitPrice: Number(m?.price || 0) }
                        : x,
                    ),
                  );
                }}
              >
                {!data.materials.some((m) => m.type === 'MATERIAL') && (
                  <option value="">Agrega materiales al catálogo</option>
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
            <Field label="Cantidad">
              <input
                aria-label={`Cantidad ${i + 1}`}
                type="number"
                required
                min="0.0001"
                step="0.0001"
                value={l.quantity || ''}
                onChange={(e) =>
                  setOrderLines((prev) =>
                    prev.map((x, j) => (i === j ? { ...x, quantity: Number(e.target.value) } : x)),
                  )
                }
              />
            </Field>
            <Field label="Precio unitario">
              <input
                aria-label={`Precio unitario ${i + 1}`}
                type="number"
                required
                min="0.0001"
                step="0.0001"
                value={l.unitPrice || ''}
                onChange={(e) =>
                  setOrderLines((prev) =>
                    prev.map((x, j) => (i === j ? { ...x, unitPrice: Number(e.target.value) } : x)),
                  )
                }
              />
            </Field>
            <button
              className="icon-button"
              type="button"
              aria-label={`Quitar material ${i + 1}`}
              disabled={orderLines.length === 1}
              onClick={() => setOrderLines((prev) => prev.filter((_, j) => i !== j))}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="text-button"
          onClick={() =>
            setOrderLines((prev) => [
              ...prev,
              {
                materialId: data.materials.find((m) => m.type === 'MATERIAL')?.id || '',
                quantity: 1,
                unitPrice: Number(data.materials.find((m) => m.type === 'MATERIAL')?.price || 0),
              },
            ])
          }
        >
          <Plus size={15} />
          Agregar material
        </button>
      </div>
      <div className="calculation">
        <span>
          Total directo <b>{money(orderLines.reduce((n, l) => n + l.quantity * l.unitPrice, 0))}</b>
        </span>
      </div>
      <p className="small-note">
        Importes sin impuestos. Esta versión admite compras de materiales, no servicios.
      </p>
      {errors}
      {actions('Crear orden', !chosen || !orderLines[0]?.materialId)}
    </form>
  );
}
