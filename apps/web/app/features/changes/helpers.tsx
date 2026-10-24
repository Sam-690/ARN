'use client';
export type Save = (path: string, body: unknown, message: string) => Promise<boolean>;
export const money = (n: string | number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(n));
export const day = (d: string) => d.slice(0, 10);
export const time = (d: string) =>
  new Date(d).toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Mexico_City',
  });
export const today = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
export const changeLabels: Record<string, string> = {
  DRAFT: 'Borrador',
  SUBMITTED: 'Por autorizar',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
  CANCELLED: 'Cancelado',
};
export const actionLabels: Record<string, string> = {
  CREATED: 'Solicitud creada',
  REVISE: 'Nueva revisión',
  SUBMIT: 'Enviado a autorización',
  APPROVE: 'Autorización registrada',
  REJECT: 'Propuesta rechazada',
  CANCEL: 'Solicitud cancelada',
  PROGRESS: 'Avance registrado',
  SETTLEMENT: 'Cobro / crédito registrado',
};
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function proposalValues(v: Record<string, FormDataEntryValue>) {
  return {
    scope: v.scope,
    costDelta: v.costDelta,
    priceDelta: v.priceDelta,
    daysDelta: Number(v.daysDelta),
  };
}
