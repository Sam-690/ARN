import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { accessRules, actorFrom, can, rolePermissions } from '../apps/api/src/access';
test('actor público nunca propaga hashes ni relaciones completas', () => {
  const actor = actorFrom({
    id: 'u',
    name: 'U',
    email: 'u@test.local',
    role: 'VIEWER',
    active: true,
    mustChangePassword: false,
    revision: 0,
    memberships: [{ projectId: 'p' }],
    passwordHash: 'secret',
    sessions: ['secret'],
  } as any);
  assert.equal('passwordHash' in actor, false);
  assert.equal('sessions' in actor, false);
  assert.deepEqual(actor.projectIds, ['p']);
});
test('perfiles separan pago, compra, aprobación, almacén y administración', () => {
  assert.equal(can({ role: 'PURCHASING' }, 'orders'), true);
  assert.equal(can({ role: 'PURCHASING' }, 'approveOrder'), false);
  assert.equal(can({ role: 'PURCHASING' }, 'stock'), false);
  assert.equal(can({ role: 'WAREHOUSE' }, 'stock'), true);
  assert.equal(can({ role: 'WAREHOUSE' }, 'payments'), false);
  assert.equal(can({ role: 'FINANCE' }, 'payments'), true);
  assert.equal(can({ role: 'RESIDENT' }, 'approveChange'), false);
  for (const role of Object.keys(rolePermissions).filter((r) => r !== 'ADMIN'))
    assert.equal(can({ role }, 'users'), false);
  assert.equal(can({ role: 'VIEWER' }, 'logs'), false);
  assert.equal(can({ role: 'invented' }, 'users'), false);
});
test('cada ruta publicada tiene política explícita; las nuevas no se autorizan por defecto', () => {
  const controllers = readdirSync('apps/api/src/modules').filter((file) =>
    file.endsWith('.controller.ts'),
  );
  assert.ok(controllers.length > 0, 'Deben existir controladores para revisar sus políticas');
  const source = controllers
    .map((file) => readFileSync(`apps/api/src/modules/${file}`, 'utf8'))
    .join('\n');
  const routes = [...source.matchAll(/@(Get|Post)\('([^']+)'\)/g)];
  assert.ok(routes.length > 0, 'La revisión debe encontrar rutas publicadas');
  const uniqueRoutes = new Set(routes.map((route) => `${route[1]} ${route[2]}`));
  assert.equal(uniqueRoutes.size, routes.length, 'No debe haber rutas duplicadas');
  for (const m of routes) {
    if (['health', 'auth/login'].includes(m[2])) continue;
    const route = m[2].replace(/:[^/]+/g, 'sample');
    assert.ok(
      accessRules.some((r) => r.method === m[1].toUpperCase() && r.pattern.test(route)),
      `Falta política: ${m[1]} ${route}`,
    );
  }
  assert.equal(
    accessRules.some((r) => r.pattern.test('new/unclassified/action')),
    false,
  );
});
