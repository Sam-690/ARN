'use client';
export const qty = (n: string | number) =>
  new Intl.NumberFormat('es-MX', { maximumFractionDigits: 4 }).format(Number(n));
export const money = (n: string | number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(n));
export const day = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export type Option = {
  kind: 'BUY' | 'TRANSFER';
  label: string;
  fromProjectId: string;
  unitPrice: string;
  freight: string;
  arrival: string;
  confirmed: boolean;
  reference: string;
};
export const freshOption = (): Option => ({
  kind: 'BUY',
  label: '',
  fromProjectId: '',
  unitPrice: '',
  freight: '',
  arrival: '',
  confirmed: false,
  reference: '',
});
