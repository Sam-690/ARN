'use client';
import { EntryModal } from './entry-modal';
import { useEffect, useState, FormEvent } from 'react';
import { Plus, RefreshCw, Users, LockKeyhole } from 'lucide-react';
import type { Data } from './types';
type TeamUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  mustChangePassword: boolean;
  revision: number;
  memberships: { projectId: string }[];
};
type Role = { id: string; label: string; permissions: string[] };
const explanations: Record<string, string> = {
  ADMIN: 'Todas las obras, usuarios, catálogo y operaciones.',
  MANAGER:
    'Presupuestos, aprobaciones, compras, almacén y seguimiento. Sin registrar pagos ni administrar usuarios.',
  PURCHASING:
    'Compras en borrador, necesidades y documentos. Sin aprobar compras, recibir material ni pagar.',
  WAREHOUSE:
    'Recepciones, salidas, sobrantes, traspasos y necesidades. Sin comprar, aprobar ni pagar.',
  RESIDENT:
    'Bitácoras, planos, necesidades, propuestas de cambios y ejecución. Sin aprobaciones ni pagos.',
  FINANCE: 'Pagos y documentos. Sin compras ni movimientos de inventario.',
  VIEWER: 'Consulta y exportación. Sin modificar registros.',
};
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
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
export function TeamPanel({ data }: { data: Data }) {
  const [users, setUsers] = useState<TeamUser[]>([]),
    [roles, setRoles] = useState<Role[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [editing, setEditing] = useState<TeamUser | 'new' | null>(null),
    [reset, setReset] = useState(false),
    [role, setRole] = useState('VIEWER'),
    [projects, setProjects] = useState<string[]>([]);
  async function refresh() {
    setError('');
    try {
      const r = await fetch('/api/users', { cache: 'no-store' });
      const v = await r.json();
      if (!r.ok) throw new Error(v.message);
      setUsers(v.users);
      setRoles(v.roles);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    refresh();
  }, []);
  function edit(u: TeamUser | 'new', password = false) {
    setEditing(u);
    setReset(password);
    setRole(u === 'new' ? 'VIEWER' : u.role);
    setProjects(u === 'new' ? [] : u.memberships.map((m) => m.projectId));
    setError('');
    setMessage('');
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const f = new FormData(e.currentTarget),
      isNew = editing === 'new';
    const path = isNew ? 'users' : `users/${editing.id}${reset ? '/password' : ''}`;
    const body = reset
      ? {
          password: f.get('password'),
          expectedRevision: !isNew ? editing.revision : 0,
          reason: f.get('reason'),
        }
      : {
          name: f.get('name'),
          email: f.get('email'),
          role,
          projectIds: role === 'ADMIN' ? [] : projects,
          ...(isNew
            ? { password: f.get('password') }
            : {
                active: f.get('active') === 'on',
                expectedRevision: editing.revision,
                reason: f.get('reason'),
              }),
        };
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/' + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify(body),
      });
      const v = await r.json();
      if (!r.ok) throw new Error(v.message || 'No se pudo guardar');
      setEditing(null);
      setMessage(
        isNew
          ? 'Cuenta creada. Entrega la contraseña temporal personalmente por un canal seguro. No se envió ningún correo.'
          : 'Acceso actualizado. Las sesiones anteriores se cerraron.',
      );
      if (!isNew && editing.id === data.user.id) {
        window.location.reload();
        return;
      }
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="experience-module team-module">
      <section className="panel experience-form">
        <div className="panel-head">
          <div>
            <Users size={24} />
            <h2>Equipo y acceso por obra</h2>
            <p>
              Solo administración gestiona las cuentas. Los perfiles internos consultan información
              y costos de sus obras asignadas; el rol define qué pueden modificar.
            </p>
          </div>
          <button className="primary" disabled={busy} onClick={() => edit('new')}>
            <Plus size={16} />
            Nuevo usuario
          </button>
        </div>
        <p className="experience-notice">
          Las cuentas sin obras asignadas no ven datos de obras. Administración tiene acceso global.
          Los traspasos requieren acceso a origen y destino. El catálogo de insumos y las
          definiciones de grupos de experiencia son compartidos.
        </p>
      </section>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="experience-notice" role="status">
          {message}
        </p>
      )}
      {editing && (
        <EntryModal
          title={editing === 'new' ? 'Nuevo usuario' : 'Editar acceso'}
          busy={busy}
          error={error}
          onClose={() => setEditing(null)}
        >
          <section className="panel experience-form">
            <h2>
              {editing === 'new'
                ? 'Crear usuario'
                : reset
                  ? 'Renovar contraseña temporal'
                  : `Editar acceso · ${editing.name}`}
            </h2>
            <form key={(editing === 'new' ? 'new' : editing.id) + reset} onSubmit={submit}>
              <fieldset disabled={busy}>
                {!reset && (
                  <>
                    <div className="form-grid">
                      <Field label="Nombre">
                        <input
                          name="name"
                          required
                          maxLength={200}
                          defaultValue={editing === 'new' ? '' : editing.name}
                        />
                      </Field>
                      <Field label="Correo de acceso">
                        <input
                          name="email"
                          type="email"
                          required
                          maxLength={200}
                          defaultValue={editing === 'new' ? '' : editing.email}
                        />
                      </Field>
                      <Field label="Perfil">
                        <select value={role} onChange={(e) => setRole(e.target.value)}>
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <p className="experience-notice">{explanations[role]}</p>
                    {role !== 'ADMIN' && (
                      <fieldset className="team-projects">
                        <legend>Obras permitidas · {projects.length}</legend>
                        {data.projects.map((p) => (
                          <label className="document-confirm" key={p.id}>
                            <input
                              type="checkbox"
                              checked={projects.includes(p.id)}
                              onChange={(e) =>
                                setProjects(
                                  e.target.checked
                                    ? [...projects, p.id]
                                    : projects.filter((id) => id !== p.id),
                                )
                              }
                            />
                            {p.code} · {p.name}
                            {p.status === 'CLOSED' ? ' · Cerrada' : ''}
                          </label>
                        ))}
                      </fieldset>
                    )}
                    {editing !== 'new' && (
                      <label className="document-confirm">
                        <input name="active" type="checkbox" defaultChecked={editing.active} />
                        Cuenta activa
                      </label>
                    )}
                  </>
                )}
                {(editing === 'new' || reset) && (
                  <Field label="Contraseña temporal (mínimo 12 caracteres)">
                    <input
                      name="password"
                      type="password"
                      required
                      minLength={12}
                      maxLength={128}
                      autoComplete="new-password"
                    />
                  </Field>
                )}
                {editing !== 'new' && (
                  <Field label="Motivo del cambio">
                    <input name="reason" required maxLength={200} />
                  </Field>
                )}
                <p className="small-note">
                  {editing === 'new' || reset
                    ? 'Se exigirá cambiar la contraseña al entrar.'
                    : 'Guardar revoca las sesiones del usuario, incluso si solo cambias su nombre.'}
                </p>
                <label className="document-confirm">
                  <input type="checkbox" required />
                  Revisé el perfil y las obras que tendrá esta cuenta.
                </label>
                <div className="log-actions">
                  <button className="primary">
                    Guardar {editing === 'new' ? 'usuario' : 'cambio'}
                  </button>
                  <button type="button" className="secondary" onClick={() => setEditing(null)}>
                    Cancelar
                  </button>
                </div>
              </fieldset>
            </form>
          </section>
        </EntryModal>
      )}
      <section className="panel experience-form">
        <div className="panel-head">
          <h2>Cuentas del equipo</h2>
          <button className="secondary" disabled={busy} onClick={refresh}>
            <RefreshCw size={16} />
            Actualizar
          </button>
        </div>
        <div className="forecast-cards">
          {users.map((u) => (
            <article className="detail-box" key={u.id}>
              <span className="badge">
                {u.active ? 'Activa' : 'Desactivada'}
                {u.mustChangePassword ? ' · Cambio de contraseña pendiente' : ''}
              </span>
              <h3>
                {u.name}
                {u.id === data.user.id ? ' · Tu cuenta' : ''}
              </h3>
              <p>
                {u.email} · {roles.find((r) => r.id === u.role)?.label}
              </p>
              <p>
                {u.role === 'ADMIN'
                  ? 'Todas las obras'
                  : u.memberships.length
                    ? u.memberships
                        .map((m) => data.projects.find((p) => p.id === m.projectId)?.code || 'Obra')
                        .join(', ')
                    : 'Sin obras asignadas'}
              </p>
              <div className="log-actions">
                <button className="secondary" disabled={busy} onClick={() => edit(u)}>
                  Editar acceso
                </button>
                {u.id !== data.user.id && (
                  <button className="secondary" disabled={busy} onClick={() => edit(u, true)}>
                    Renovar contraseña
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
      <details className="panel experience-form">
        <summary>Qué permite cada perfil</summary>
        {roles.map((r) => (
          <article key={r.id}>
            <h3>{r.label}</h3>
            <p>{explanations[r.id]}</p>
          </article>
        ))}
      </details>
    </div>
  );
}
