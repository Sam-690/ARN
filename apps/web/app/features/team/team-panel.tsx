'use client';
import { Plus, RefreshCw, Users } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { EntryModal } from '../../entry-modal';
import type { Data } from '../../types';
import { explanations, Field, Role, TeamUser } from './helpers';
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
