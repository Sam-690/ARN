'use client';
import { useEffect, useState } from 'react';
export const time = (d: string) =>
  new Date(d).toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Mexico_City',
  });
export const fileLimit = 8 * 1024 * 1024;
export type Save = (path: string, body: unknown, message: string) => Promise<boolean>;
export function Preview({ file }: { file: File }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return file.type.startsWith('image/') ? (
    <img className="pending-image" src={url || undefined} alt="Vista previa de evidencia" />
  ) : (
    <audio controls src={url || undefined} preload="metadata" />
  );
}
