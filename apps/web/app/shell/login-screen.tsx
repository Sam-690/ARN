'use client';
import { ArrowRight, Building2, LoaderCircle, LockKeyhole } from 'lucide-react';
import { Field } from '../shared/presentation';
import { ThemeSwitch } from '../theme-switch';
export function LoginScreen({
  setBusy,
  setError,
  refresh,
  error,
  busy,
}: {
  setBusy: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string>>;
  refresh: () => Promise<void>;
  error: string;
  busy: boolean;
}) {
  return (
    <div className="login">
      <div className="login-art">
        <div className="brand">
          <span className="brand-mark">
            <Building2 />
          </span>
          obra<span className="brand-dot">.</span>
        </div>
        <span className="eyebrow light">CONTROL QUE CONSTRUYE</span>
        <h1>
          De la primera idea
          <br />a la última entrega.
        </h1>
        <p>
          Tus proyectos, materiales y decisiones.
          <br />
          Todo conectado en un mismo lugar.
        </p>
        <div className="building-art">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <span className="login-foot">Una empresa. Todas tus obras.</span>
      </div>
      <div className="login-form">
        <ThemeSwitch />
        <span className="eyebrow">TU ESPACIO DE TRABAJO</span>
        <h2>Bienvenido a Obra</h2>
        <p>Inicia sesión para continuar.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            const f = new FormData(e.currentTarget);
            try {
              const r = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(Object.fromEntries(f)),
              });
              if (!r.ok) throw new Error((await r.json()).message);
              await refresh();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Correo electrónico">
            <input
              name="email"
              type="email"
              required
              defaultValue="admin@obra.local"
              autoComplete="username"
            />
          </Field>
          <Field label="Contraseña">
            <input name="password" type="password" required autoComplete="current-password" />
          </Field>
          {error && (
            <div role="alert" className="error">
              {error}
            </div>
          )}
          <button className="primary full" disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={17} /> : <ArrowRight size={17} />}Entrar al
            espacio
          </button>
        </form>
        <div className="demo-note">
          <LockKeyhole size={18} />
          <div>
            <strong>Acceso del equipo</strong>
            <p>Solicita una cuenta y tus obras asignadas a administración.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
