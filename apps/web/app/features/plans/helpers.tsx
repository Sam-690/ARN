'use client';
export type Save = (path: string, body: unknown, message: string) => Promise<boolean>;
export const statusLabel: Record<string, string> = {
  OPEN: 'Abierta',
  IN_PROGRESS: 'En atención',
  RESOLVED: 'Resuelta',
};
export const actionLabel: Record<string, string> = {
  CREATED: 'Registro',
  COMMENT: 'Comentario',
  START: 'Inicio de atención',
  RESOLVE: 'Resolución',
  REOPEN: 'Reapertura',
  ASSIGN: 'Responsable / fecha actualizados',
};
export const priorityLabel: Record<string, string> = {
  LOW: 'Baja',
  NORMAL: 'Normal',
  HIGH: 'Alta',
};
export const today = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
export const timestamp = (s: string) =>
  new Date(s).toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Mexico_City',
  });
export async function fileData(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
