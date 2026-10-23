import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Obra · Control de proyectos',
  description: 'Presupuestos, compras y control de obra en un solo lugar.',
};
// Apply the saved palette before first paint; only this attribute differs from SSR.
const appearanceScript = `(function(){try{document.documentElement.dataset.theme=localStorage.getItem('obra-appearance')==='light'?'light':'dark'}catch{}})()`;
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: appearanceScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
