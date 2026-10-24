'use client';
import { Plus } from 'lucide-react';
import { Field, Save } from './helpers';
export function FamilyForm({
  save,
  busy,
  onDone,
}: {
  save: Save;
  busy: boolean;
  onDone: () => void;
}) {
  return (
    <form
      className="panel experience-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const v = Object.fromEntries(new FormData(e.currentTarget));
        if (await save('experience/families', v, 'Grupo de comparación creado')) onDone();
      }}
    >
      <h2>Nuevo grupo comparable</h2>
      <p className="small-note">
        Define qué trabajos se pueden comparar. Esta versión quedará fija; si cambia el método o las
        condiciones, crea otra versión.
      </p>
      <fieldset disabled={busy}>
        <div className="form-grid">
          {[
            ['code', 'Clave', '24'],
            ['version', 'Versión del método', '40'],
            ['name', 'Nombre del grupo', '200'],
            ['unit', 'Unidad ejecutada', '16'],
          ].map(([name, label, max]) => (
            <Field key={name} label={label}>
              <input name={name} required maxLength={Number(max)} />
            </Field>
          ))}
        </div>
        <Field label="Método y especificación">
          <textarea
            name="method"
            required
            maxLength={2000}
            rows={3}
            placeholder="Ej. Muro de block de 15 cm, mortero y cuadrilla definidos"
          />
        </Field>
        <Field label="Condiciones comparables">
          <textarea
            name="conditions"
            required
            maxLength={2000}
            rows={3}
            placeholder="Altura, acceso, equipo, clima y restricciones del trabajo"
          />
        </Field>
        <button className="primary">
          <Plus size={16} />
          Guardar grupo
        </button>
      </fieldset>
    </form>
  );
}
