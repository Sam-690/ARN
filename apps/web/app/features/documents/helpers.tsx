'use client';
export type Save = (path: string, body: unknown, message: string) => Promise<boolean>;
export const labels: Record<string, string> = {
  DRAFT: 'Por revisar',
  REVIEWED: 'Revisado',
  APPLIED: 'Aplicado',
};
export const kinds: Record<string, string> = {
  QUOTE: 'Cotización',
  DELIVERY: 'Remisión',
  INVOICE: 'Factura',
};
export const money = (n: number | string) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(n));
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export const blankLine = () => ({
  description: '',
  unit: '',
  quantity: 0,
  unitPrice: 0,
  materialId: '',
});
