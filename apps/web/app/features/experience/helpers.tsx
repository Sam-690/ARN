'use client';
export type Save = (path: string, body: unknown, message: string) => Promise<boolean>;
export const money = (n: string | number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(n));
export const qty = (n: string | number) =>
  new Intl.NumberFormat('es-MX', { maximumFractionDigits: 4 }).format(Number(n));
export const day = (s: string) => s.slice(0, 10);
export const localDay = (s: string) =>
  new Date(s).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
export const today = () => localDay(new Date().toISOString());
export const statusLabels: Record<string, string> = {
  RECORDED: 'Por validar',
  VALIDATED: 'Muestra validada',
  VOID: 'Anulado',
};
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
