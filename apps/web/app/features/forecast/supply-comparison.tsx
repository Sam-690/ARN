'use client';
import type { Material } from '../../types';
import { Plus, Trash2 } from 'lucide-react';
import { FormEvent } from 'react';
import { EntryModal } from '../../entry-modal';
import type { ForecastResult } from '../../types';
import { Field, freshOption, money, Option, qty } from './helpers';
export function SupplyComparison({
  busy,
  setComparisonOpen,
  comparisonOpen,
  error,
  calculate,
  m,
  amount,
  setAmount,
  setOptions,
  options,
  setComparisonDirty,
  needed,
  setNeeded,
  editOption,
  result,
  resultsRef,
  comparisonDirty,
  onSupply,
  target,
}: {
  busy: boolean;
  setComparisonOpen: React.Dispatch<React.SetStateAction<boolean>>;
  comparisonOpen: boolean;
  error: string;
  calculate: (compare?: boolean) => Promise<void>;
  m: Material | undefined;
  amount: string;
  setAmount: React.Dispatch<React.SetStateAction<string>>;
  setOptions: React.Dispatch<React.SetStateAction<Option[]>>;
  options: Option[];
  setComparisonDirty: React.Dispatch<React.SetStateAction<boolean>>;
  needed: string;
  setNeeded: React.Dispatch<React.SetStateAction<string>>;
  editOption: (index: number, patch: Partial<Option>) => void;
  result: ForecastResult;
  resultsRef: React.RefObject<HTMLDivElement | null>;
  comparisonDirty: boolean;
  onSupply: (projectId: string) => void;
  target: string;
}) {
  return (
    <section className="panel experience-form">
      <h2>Comparar compra y traslado</h2>
      <p>
        Evalúa alternativas completas para una cantidad y una fecha. Los sobrantes publicados son
        candidatos; se verifica su disponibilidad al recalcular.
      </p>
      <p className="small-note">
        Costo comparable = material + flete, en MXN netos sin impuestos. En traslado se usa el costo
        promedio del almacén de origen, no una cotización editable. El flete solo participa en esta
        simulación.
      </p>
      <button className="secondary" disabled={busy} onClick={() => setComparisonOpen(true)}>
        Capturar alternativas
      </button>
      {comparisonOpen && (
        <EntryModal
          title="Alternativas de abastecimiento"
          busy={busy}
          error={error}
          onClose={() => setComparisonOpen(false)}
        >
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              calculate(true);
            }}
          >
            <fieldset disabled={busy}>
              <div className="form-grid">
                <Field label={`Cantidad a comparar (${m?.unit})`}>
                  <input
                    required
                    type="number"
                    min="0.0001"
                    max="100000000"
                    step="0.0001"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setOptions(options.map((o) => ({ ...o, confirmed: false })));
                      setComparisonDirty(true);
                    }}
                  />
                </Field>
                <Field label="Fecha necesaria para esta cantidad">
                  <input
                    required
                    type="date"
                    value={needed}
                    onChange={(e) => {
                      setNeeded(e.target.value);
                      setOptions(options.map((o) => ({ ...o, confirmed: false })));
                      setComparisonDirty(true);
                    }}
                  />
                </Field>
              </div>
              <p className="small-note">
                La cantidad inicial es la máxima brecha del horizonte; la fecha inicial es la
                primera brecha. Es una comparación conservadora de un solo lote. Puedes ajustar
                ambos valores según tu programa.
              </p>
              {options.map((o, i) => (
                <article className="forecast-option" key={i}>
                  <div className="forecast-heading">
                    <h3>Alternativa {i + 1}</h3>
                    <button
                      type="button"
                      className="icon-button"
                      disabled={options.length === 1}
                      aria-label={`Eliminar alternativa ${i + 1}`}
                      onClick={() => {
                        setOptions(options.filter((_, j) => i !== j));
                        setComparisonDirty(true);
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="form-grid">
                    <Field label="Tipo">
                      <select
                        value={o.kind}
                        onChange={(e) =>
                          editOption(i, {
                            kind: e.target.value as Option['kind'],
                            fromProjectId: '',
                            label: '',
                            unitPrice: '',
                          })
                        }
                      >
                        <option value="BUY">Compra a proveedor</option>
                        <option value="TRANSFER">Traspaso de otra obra</option>
                      </select>
                    </Field>
                    {o.kind === 'BUY' ? (
                      <>
                        <Field label="Proveedor / alternativa">
                          <input
                            required
                            maxLength={200}
                            value={o.label}
                            onChange={(e) => editOption(i, { label: e.target.value })}
                          />
                        </Field>
                        <Field label={`Precio neto por ${m?.unit}`}>
                          <input
                            required
                            type="number"
                            min="0"
                            max="100000000"
                            step="0.0001"
                            value={o.unitPrice}
                            onChange={(e) => editOption(i, { unitPrice: e.target.value })}
                          />
                        </Field>
                      </>
                    ) : (
                      <Field label="Obra con sobrante liberado">
                        <select
                          required
                          value={o.fromProjectId}
                          onChange={(e) => {
                            const a = result.alternatives.find(
                              (a) => a.projectId === e.target.value,
                            );
                            editOption(i, {
                              fromProjectId: e.target.value,
                              label: a?.name || '',
                              unitPrice: a?.unitCost || '',
                            });
                          }}
                        >
                          <option value="">
                            {result.alternatives.length
                              ? 'Selecciona origen'
                              : 'No hay sobrantes publicados en otras obras'}
                          </option>
                          {result.alternatives.map((a) => (
                            <option key={a.projectId} value={a.projectId}>
                              {a.name} · {qty(a.available)} {m?.unit} · {money(a.unitCost)}/
                              {m?.unit}
                            </option>
                          ))}
                        </select>
                      </Field>
                    )}
                    <Field label="Flete total neto (MXN)">
                      <input
                        required
                        type="number"
                        min="0"
                        max="100000000"
                        step="0.0001"
                        value={o.freight}
                        onChange={(e) => editOption(i, { freight: e.target.value })}
                      />
                    </Field>
                    <Field label="Fecha de llegada">
                      <input
                        required
                        type="date"
                        value={o.arrival}
                        onChange={(e) => editOption(i, { arrival: e.target.value })}
                      />
                    </Field>
                    <Field label="Soporte: cotización / responsable / fecha">
                      <input
                        required
                        maxLength={500}
                        value={o.reference}
                        onChange={(e) => editOption(i, { reference: e.target.value })}
                      />
                    </Field>
                  </div>
                  <label className="document-confirm">
                    <input
                      type="checkbox"
                      checked={o.confirmed}
                      onChange={(e) => editOption(i, { confirmed: e.target.checked })}
                    />
                    Confirmé disponibilidad para toda la cantidad, precio, flete y fecha con el
                    proveedor o responsable.
                  </label>
                </article>
              ))}
              <div className="log-actions">
                <button
                  type="button"
                  className="secondary"
                  disabled={options.length >= 10}
                  onClick={() => {
                    setOptions([...options, freshOption()]);
                    setComparisonDirty(true);
                  }}
                >
                  <Plus size={16} />
                  Añadir alternativa
                </button>
                <button className="primary">Comparar alternativas</button>
              </div>
            </fieldset>
          </form>
        </EntryModal>
      )}
      <div ref={resultsRef} className="plan-anchor">
        {comparisonDirty && result.comparison ? (
          <p className="experience-notice">
            Cambiaste el escenario. Vuelve a comparar para actualizar el resultado.
          </p>
        ) : (
          result.comparison && (
            <>
              <h3>
                {result.comparison.recommendedIndex === null
                  ? 'Ninguna alternativa cumple todas las condiciones'
                  : 'Menor costo entre las alternativas viables'}
              </h3>
              <div className="forecast-cards">
                {result.comparison.options.map((o) => (
                  <article
                    key={o.index}
                    className={
                      'detail-box ' +
                      (o.index === result.comparison!.recommendedIndex ? 'forecast-best' : '')
                    }
                  >
                    <span className="badge">
                      {o.index === result.comparison!.recommendedIndex
                        ? 'Recomendada'
                        : o.eligible
                          ? 'Viable'
                          : 'Revisar'}
                    </span>
                    <h3>{o.label}</h3>
                    <strong>{money(o.total)}</strong>
                    <p>
                      {qty(result.comparison!.quantity)} {m?.unit} × {money(o.unitPrice)} +{' '}
                      {money(o.freight)} de flete · llega {o.arrival}
                    </p>
                    {o.reasons.map((reason) => (
                      <p key={reason} className="forecast-negative">
                        {reason}
                      </p>
                    ))}
                    <p className="small-note">Soporte: {o.reference || 'No proporcionado'}</p>
                  </article>
                ))}
              </div>
              {result.comparison.saving !== null && (
                <p>
                  Diferencia entre la opción viable más costosa y la recomendada:{' '}
                  {money(result.comparison.saving)}. No representa un ahorro realizado.
                </p>
              )}
              <p className="experience-notice">
                Esta simulación no reserva sobrantes, despacha, compra ni registra pagos. No combina
                lotes parciales ni optimiza varias obras a la vez. Antes de ejecutar, revalida las
                existencias y los acuerdos.
              </p>
              <button className="secondary" onClick={() => onSupply(target)}>
                Ir a Abastecimiento
              </button>
            </>
          )
        )}
      </div>
    </section>
  );
}
