'use client';

import {useLayoutEffect, useState} from 'react';
import {Sun, Moon} from 'lucide-react';

const storageKey = 'obra-appearance';
type Appearance = 'light' | 'dark';

export function ThemeSwitch() {
  const [appearance, setAppearance] = useState<Appearance>('dark');

  useLayoutEffect(() => {
    function apply(value: string | null) {
      const next = value === 'light' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      setAppearance(next);
    }
    try { apply(localStorage.getItem(storageKey)); }
    catch { apply(document.documentElement.dataset.theme ?? 'dark'); }
    function sync(event: StorageEvent) {
      if (event.key === storageKey || event.key === null) apply(event.newValue);
    }
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  function select(next: Appearance) {
    document.documentElement.dataset.theme = next;
    setAppearance(next);
    try { localStorage.setItem(storageKey, next); } catch { /* Remains usable when storage is unavailable. */ }
  }

  return <div className="theme-switch" role="group" aria-label="Apariencia">
    <button type="button" aria-pressed={appearance === 'light'} onClick={() => select('light')}><Sun size={14}/>Claro</button>
    <button type="button" aria-pressed={appearance === 'dark'} onClick={() => select('dark')}><Moon size={14}/>Oscuro</button>
  </div>;
}
