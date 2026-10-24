'use client';
import type { Project } from '../../types';
import { TrendingUp } from 'lucide-react';
import type { Data } from '../../types';
import { Field } from './helpers';
export function ForecastParameters({
  calculate,
  busy,
  projectId,
  target,
  invalidate,
  setTarget,
  data,
  material,
  setMaterial,
  horizon,
  setHorizon,
  lead,
  setLead,
  safety,
  setSafety,
  p,
  error,
}: {
  calculate: (compare?: boolean) => Promise<void>;
  busy: boolean;
  projectId: string;
  target: string;
  invalidate: () => void;
  setTarget: React.Dispatch<React.SetStateAction<string>>;
  data: Data;
  material: string;
  setMaterial: React.Dispatch<React.SetStateAction<string>>;
  horizon: string;
  setHorizon: React.Dispatch<React.SetStateAction<string>>;
  lead: string;
  setLead: React.Dispatch<React.SetStateAction<string>>;
  safety: string;
  setSafety: React.Dispatch<React.SetStateAction<string>>;
  p: Project | undefined;
  error: string;
}) {
  return (
    <section className="panel experience-form">
      <div className="forecast-heading">
        <TrendingUp size={25} />
        <div>
          <h2>Anticipa la siguiente compra</h2>
          <p className="small-note">
            Escenario de apoyo: revisa las fuentes y confirma la logística antes de actuar. Puedes
            exportarlo; los escenarios no se guardan al cambiar de obra o salir.
          </p>
        </div>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          calculate();
        }}
      >
        <fieldset disabled={busy}>
          <div className="form-grid">
            {projectId === 'all' && (
              <Field label="Obra a analizar">
                <select
                  required
                  value={target}
                  onChange={(e) => {
                    invalidate();
                    setTarget(e.target.value);
                  }}
                >
                  {data.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} · {p.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Material a analizar">
              <select
                required
                value={material}
                onChange={(e) => {
                  invalidate();
                  setMaterial(e.target.value);
                }}
              >
                {data.materials
                  .filter((m) => m.type === 'MATERIAL')
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} · {m.unit}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Horizonte (días naturales)">
              <input
                type="number"
                min="1"
                max="90"
                required
                value={horizon}
                onChange={(e) => {
                  invalidate();
                  setHorizon(e.target.value);
                }}
              />
            </Field>
            <Field label="Plazo para abastecer (días)">
              <input
                type="number"
                min="0"
                max="365"
                required
                value={lead}
                onChange={(e) => {
                  invalidate();
                  setLead(e.target.value);
                }}
              />
            </Field>
            <Field label="Reserva preventiva (días de consumo)">
              <input
                type="number"
                min="0"
                max="30"
                required
                value={safety}
                onChange={(e) => {
                  invalidate();
                  setSafety(e.target.value);
                }}
              />
            </Field>
          </div>
          <button className="primary" disabled={!target || !material}>
            {busy ? 'Calculando…' : 'Calcular escenario'}
          </button>
        </fieldset>
      </form>
      {p?.status === 'CLOSED' && (
        <p className="experience-notice">
          Obra cerrada: consulta histórica. No se habilitan operaciones.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
