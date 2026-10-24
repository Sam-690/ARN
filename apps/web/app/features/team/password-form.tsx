'use client';
import { LockKeyhole } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Field } from './helpers';
export function PasswordForm({
  required = false,
  onDone,
  onCancel,
}: {
  required?: boolean;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get('password') !== f.get('confirm')) {
      setError('Las contraseñas nuevas no coinciden');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({
          currentPassword: f.get('currentPassword'),
          password: f.get('password'),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || 'No se pudo cambiar la contraseña');
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel experience-form password-panel">
      <LockKeyhole size={24} />
      <h2>{required ? 'Cambia tu contraseña temporal' : 'Cambiar mi contraseña'}</h2>
      <p>
        Usa al menos 12 caracteres. Al guardar se cerrarán todas tus sesiones y podrás entrar con tu
        nueva contraseña.
      </p>
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <Field label="Contraseña actual o temporal">
            <input
              name="currentPassword"
              type="password"
              required
              maxLength={200}
              autoComplete="current-password"
            />
          </Field>
          <Field label="Nueva contraseña">
            <input
              name="password"
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Repetir nueva contraseña">
            <input
              name="confirm"
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
            />
          </Field>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <div className="log-actions">
            <button className="primary">{busy ? 'Guardando…' : 'Guardar y volver a entrar'}</button>
            {onCancel && (
              <button type="button" className="secondary" onClick={onCancel}>
                {required ? 'Cerrar sesión' : 'Cancelar'}
              </button>
            )}
          </div>
        </fieldset>
      </form>
    </section>
  );
}
