import test from 'node:test';
import assert from 'node:assert/strict';
import { viewPreferenceKey, readViewPreference } from '../apps/web/app/shared/use-view-preference';

test('separa búsquedas y filtros por cuenta, módulo y obra', () => {
  const key = viewPreferenceKey('u1', 'orders', 'p1', 'search');
  for (const args of [
    ['u2', 'orders', 'p1', 'search'],
    ['u1', 'logs', 'p1', 'search'],
    ['u1', 'orders', 'p2', 'search'],
    ['u1', 'orders', 'p1', 'filter'],
  ])
    assert.notEqual(key, viewPreferenceKey(...(args as [string, string, string, string])));
});

test('el catálogo y el directorio conservan filtros globales entre obras', () => {
  for (const module of ['projects', 'materials', 'team'])
    assert.equal(
      viewPreferenceKey('u', module, 'p1', 'filter'),
      viewPreferenceKey('u', module, 'p2', 'filter'),
    );
});

test('restaura tipos válidos y tolera preferencias corruptas o almacenamiento bloqueado', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  let stored = '"cemento"';
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: { getItem: () => stored } },
  });
  try {
    assert.equal(readViewPreference<string>('search', ''), 'cemento');
    stored = 'true';
    assert.equal(readViewPreference<boolean>('history', false), true);
    assert.equal(readViewPreference<string>('filter', 'all'), 'all');
    stored = '{broken';
    assert.equal(readViewPreference<string>('filter', 'all'), 'all');
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      get() {
        throw new Error('blocked');
      },
    });
    assert.equal(readViewPreference<string>('search', ''), '');
  } finally {
    if (original) Object.defineProperty(globalThis, 'window', original);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
