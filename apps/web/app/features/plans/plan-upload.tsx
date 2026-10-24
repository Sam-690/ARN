'use client';
import { Upload, X } from 'lucide-react';
import { FormEvent, useState } from 'react';
import type { Data, Drawing } from '../../types';
import { Field, fileData, Save } from './helpers';
export function PlanUpload({
  data,
  projectId,
  drawing,
  busy,
  save,
  setBusy,
  onDone,
  onCancel,
}: {
  data: Data;
  projectId: string;
  drawing?: Drawing;
  busy: boolean;
  save: Save;
  setBusy: (v: boolean) => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState(''),
    [file, setFile] = useState<File | null>(null);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) return;
    const fields = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    setError('');
    try {
      if (file.size > 15 * 1024 * 1024 || !file.size) throw new Error('Usa un PDF de hasta 15 MB.');
      const base64 = await fileData(file);
      if (
        await save(
          drawing ? 'drawings/' + drawing.id + '/versions' : 'drawings',
          { ...fields, name: file.name, base64 },
          drawing
            ? 'Nueva versión guardada; las incidencias anteriores se conservan'
            : 'Plano guardado',
        )
      )
        onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="panel plan-form" onSubmit={submit}>
      <div className="panel-head">
        <div>
          <h2>{drawing ? 'Nueva versión · ' + drawing.code : 'Registrar plano'}</h2>
          <p>PDF sin contraseña · hasta 15 MB y 20 páginas por versión</p>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Cancelar carga de plano"
          disabled={busy}
          onClick={onCancel}
        >
          <X size={18} />
        </button>
      </div>
      <fieldset disabled={busy}>
        {!drawing && (
          <>
            <Field label="Obra del plano">
              <select
                name="projectId"
                defaultValue={
                  projectId === 'all'
                    ? data.projects.find((p) => p.status === 'ACTIVE')?.id
                    : projectId
                }
                required
              >
                {data.projects
                  .filter(
                    (p) => p.status === 'ACTIVE' && (projectId === 'all' || p.id === projectId),
                  )
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} · {p.name}
                    </option>
                  ))}
              </select>
            </Field>
            <div className="form-grid">
              <Field label="Clave del plano">
                <input name="code" maxLength={24} required placeholder="ARQ-01" />
              </Field>
              <Field label="Nombre del plano">
                <input
                  name="title"
                  maxLength={200}
                  required
                  placeholder="Planta arquitectónica · edificio A"
                />
              </Field>
            </div>
          </>
        )}
        <div className="form-grid">
          <Field label="Identificador de revisión">
            <input
              name="label"
              required
              maxLength={200}
              placeholder="Ej. Rev. A · emitido para construcción"
            />
          </Field>
          <Field label="Archivo PDF">
            <input
              type="file"
              name="pdfFile"
              accept="application/pdf,.pdf"
              required
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </Field>
        </div>
        <Field label="Descripción de esta versión">
          <textarea
            name="note"
            required
            rows={2}
            maxLength={2000}
            placeholder="Describe el alcance o los cambios de esta revisión"
          />
        </Field>
        {drawing && (
          <p className="small-note">
            Esta carga crea una versión nueva. Las anteriores y sus marcadores conservarán su página
            y ubicación originales.
          </p>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="log-actions">
          <button type="button" className="secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button className="primary" disabled={!file}>
            <Upload size={16} />
            {busy ? 'Guardando…' : 'Guardar plano'}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
