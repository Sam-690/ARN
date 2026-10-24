'use client';
import { type ReactNode } from 'react';
import type { Data } from '../../types';
export type Dialog = { type: string; item?: any };
export type Props = { data: Data; projectId: string; open: (d: Dialog) => void };
export const qty = (n: string | number) =>
  Number(n).toLocaleString('es-MX', { maximumFractionDigits: 4 });
export const money = (n: string | number) =>
  Number(n).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
export const date = (d: string) =>
  new Date(d.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
export const today = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
export const statuses = {
  COVERED: 'Cobertura prevista',
  OVERDUE: 'Necesidad vencida',
  BUY_NOW: 'Gestionar ahora',
  PLAN: 'Por planificar',
};
export const supplyDialogTypes = ['need', 'cancelNeed', 'release', 'transfer', 'receiveTransfer'];
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
