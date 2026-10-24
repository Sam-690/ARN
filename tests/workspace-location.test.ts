import test from 'node:test';
import assert from 'node:assert/strict';
import { validateWorkspaceLocation } from '../apps/web/app/shared/workspace-location';

const access = {
  user: { id: 'user-1', permissions: [] as string[] },
  projects: [{ id: 'obra-1' }],
};

test('recupera el módulo de una obra autorizada, incluso en modo consulta', () => {
  assert.deepEqual(validateWorkspaceLocation({ page: 'orders', projectId: 'obra-1' }, access), {
    page: 'orders',
    projectId: 'obra-1',
  });
});

test('una obra eliminada o sin acceso devuelve al directorio', () => {
  assert.deepEqual(validateWorkspaceLocation({ page: 'logs', projectId: 'otra-obra' }, access), {
    page: 'projects',
    projectId: 'all',
  });
});

test('preferencias inválidas no abren módulos desconocidos ni vistas globales accidentales', () => {
  for (const value of [
    null,
    'invalid',
    {},
    { page: 'projects', projectId: 'obra-1' },
    { page: 'budget', projectId: 'all' },
  ])
    assert.deepEqual(validateWorkspaceLocation(value, access), {
      page: 'projects',
      projectId: 'all',
    });
  assert.deepEqual(
    validateWorkspaceLocation({ page: 'missing-module', projectId: 'obra-1' }, access),
    {
      page: 'dashboard',
      projectId: 'obra-1',
    },
  );
});

test('restaurar equipo respeta permisos actuales y el acceso administrativo', () => {
  const location = { page: 'team', projectId: 'obra-1' };
  assert.equal(validateWorkspaceLocation(location, access).page, 'company');
  for (const permissions of [['users'], ['*']])
    assert.equal(
      validateWorkspaceLocation(location, { ...access, user: { ...access.user, permissions } })
        .page,
      'team',
    );
});

test('la administración se restaura sin una obra asignada y migra la selección anterior', () => {
  const admin = { user: { id: 'admin', permissions: ['*'] }, projects: [] };
  for (const projectId of ['all', 'obra-antigua']) {
    assert.deepEqual(validateWorkspaceLocation({ page: 'team', projectId }, admin), {
      page: 'team',
      projectId: 'all',
    });
    assert.deepEqual(validateWorkspaceLocation({ page: 'company', projectId }, access), {
      page: 'company',
      projectId: 'all',
    });
  }
});
