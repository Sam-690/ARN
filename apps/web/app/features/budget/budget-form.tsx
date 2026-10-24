'use client';
import { Plus, Trash2 } from 'lucide-react';
import { FormEvent } from 'react';
import { Field, money } from '../../shared/presentation';
import type { Data, Project } from '../../types';
export function BudgetForm({
  mutate,
  values,
  projectSelect,
  active,
  volume,
  setVolume,
  components,
  data,
  setComponents,
  errors,
  actions,
  chosen,
}: {
  mutate: (path: string, body: unknown, message: string) => Promise<boolean>;
  values: (e: FormEvent<HTMLFormElement>) => { [k: string]: FormDataEntryValue };
  projectSelect: React.JSX.Element;
  active: Project[];
  volume: number;
  setVolume: React.Dispatch<React.SetStateAction<number>>;
  components: { name: string; quantity: number; price: number }[];
  data: Data;
  setComponents: React.Dispatch<
    React.SetStateAction<{ name: string; quantity: number; price: number }[]>
  >;
  errors: React.JSX.Element | null;
  actions: (label?: string, disabled?: boolean) => React.JSX.Element;
  chosen: any;
}) {
  return (
    <form
      onSubmit={(e) =>
        mutate('budget', { ...values(e), components }, 'Concepto agregado al presupuesto')
      }
    >
      {projectSelect}
      {!active.length && (
        <p className="small-note">
          Crea una obra o usa una con presupuesto sin aprobar para agregar conceptos.
        </p>
      )}
      <div className="form-grid">
        <Field label="Clave del concepto">
          <input name="code" required maxLength={24} />
        </Field>
        <Field label="Descripción">
          <input name="name" required maxLength={200} />
        </Field>
        <Field label="Unidad">
          <input name="unit" required maxLength={16} placeholder="m²" />
        </Field>
        <Field label="Volumen de obra">
          <input
            name="quantity"
            type="number"
            step="0.0001"
            min="0.0001"
            max="100000000"
            value={volume || ''}
            onChange={(e) => setVolume(Number(e.target.value))}
            required
          />
        </Field>
      </div>
      <div className="form-section">
        <h3>Componentes por unidad de concepto</h3>
        <p>Usa consumos por unidad. Ejemplo: 0.15 jornadas por m².</p>
        {components.map((c, i) => (
          <div className="component-row" key={i}>
            <Field label="Insumo">
              <input
                aria-label={`Insumo ${i + 1}`}
                list="catalog-options"
                value={c.name}
                maxLength={200}
                required
                onChange={(e) => {
                  const m = data.materials.find((m) => m.name === e.target.value);
                  setComponents((prev) =>
                    prev.map((x, j) =>
                      j === i
                        ? { ...x, name: e.target.value, price: m ? Number(m.price) : x.price }
                        : x,
                    ),
                  );
                }}
              />
            </Field>
            <Field label="Consumo">
              <input
                aria-label={`Consumo ${i + 1}`}
                type="number"
                min="0.0001"
                step="0.0001"
                value={c.quantity || ''}
                required
                onChange={(e) =>
                  setComponents((prev) =>
                    prev.map((x, j) => (j === i ? { ...x, quantity: Number(e.target.value) } : x)),
                  )
                }
              />
            </Field>
            <Field label="Precio">
              <input
                aria-label={`Precio ${i + 1}`}
                type="number"
                min="0.0001"
                step="0.0001"
                value={c.price || ''}
                required
                onChange={(e) =>
                  setComponents((prev) =>
                    prev.map((x, j) => (j === i ? { ...x, price: Number(e.target.value) } : x)),
                  )
                }
              />
            </Field>
            <button
              className="icon-button"
              type="button"
              aria-label={`Quitar componente ${i + 1}`}
              disabled={components.length === 1}
              onClick={() => setComponents((prev) => prev.filter((_, j) => j !== i))}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <datalist id="catalog-options">
          {data.materials.map((m) => (
            <option key={m.id} value={m.name}>
              {m.unit} · {money(m.price)}
            </option>
          ))}
        </datalist>
        <button
          type="button"
          className="text-button"
          onClick={() => setComponents((prev) => [...prev, { name: '', quantity: 1, price: 0 }])}
        >
          <Plus size={15} />
          Agregar componente
        </button>
      </div>
      <div className="calculation">
        <span>
          Precio unitario directo{' '}
          <b>{money(components.reduce((n, c) => n + c.quantity * c.price, 0))}</b>
        </span>
        <span>
          Importe estimado{' '}
          <b>{money(components.reduce((n, c) => n + c.quantity * c.price, 0) * volume)}</b>
        </span>
      </div>
      {errors}
      {actions('Guardar concepto', !chosen)}
    </form>
  );
}
