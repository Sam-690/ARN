'use client';
export type TeamUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  mustChangePassword: boolean;
  revision: number;
  memberships: { projectId: string }[];
};
export type Role = { id: string; label: string; permissions: string[] };
export const explanations: Record<string, string> = {
  ADMIN: 'Todas las obras, usuarios, catálogo y operaciones.',
  MANAGER:
    'Presupuestos, aprobaciones, compras, almacén y seguimiento. Sin registrar pagos ni administrar usuarios.',
  PURCHASING:
    'Compras en borrador, necesidades y documentos. Sin aprobar compras, recibir material ni pagar.',
  WAREHOUSE:
    'Recepciones, salidas, sobrantes, traspasos y necesidades. Sin comprar, aprobar ni pagar.',
  RESIDENT:
    'Bitácoras, planos, necesidades, propuestas de cambios y ejecución. Sin aprobaciones ni pagos.',
  FINANCE: 'Pagos y documentos. Sin compras ni movimientos de inventario.',
  VIEWER: 'Consulta y exportación. Sin modificar registros.',
};
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
