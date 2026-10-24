'use client';
import { useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';

export function viewPreferenceKey(
  userId: string,
  module: string,
  projectId: string,
  field: string,
) {
  const scope = ['projects', 'materials', 'team'].includes(module) ? 'company' : projectId;
  return `obra:view:v1:${JSON.stringify([userId, module, scope, field])}`;
}

export function readViewPreference<T extends string | boolean>(key: string | null, fallback: T): T {
  try {
    if (!key) return fallback;
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? 'null');
    return typeof value === typeof fallback ? (value as T) : fallback;
  } catch {
    return fallback;
  }
}

// Solo preferencias de consulta: nunca datos de formularios, archivos o credenciales.
export function useViewPreference<T extends string | boolean>(
  userId: string | undefined,
  module: string,
  projectId: string,
  field: string,
  fallback: T,
): [T, Dispatch<SetStateAction<T>>] {
  const key = userId ? viewPreferenceKey(userId, module, projectId, field) : null;
  const restored = useMemo(() => readViewPreference(key, fallback), [key, fallback]);
  const [edited, setEdited] = useState<{ key: string | null; value: T } | null>(null);
  const value = edited?.key === key ? edited.value : restored;
  const current = useRef(value);
  current.current = value;
  const setValue: Dispatch<SetStateAction<T>> = (update) => {
    const next = typeof update === 'function' ? update(current.current) : update;
    current.current = next;
    setEdited({ key, value: next });
    try {
      if (key) window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Si el navegador bloquea el almacenamiento, la vista sigue siendo utilizable.
    }
  };
  return [value, setValue];
}
