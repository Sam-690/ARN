'use client';
import {
  Activity,
  Calculator,
  FileText,
  Layers,
  LayoutDashboard,
  MapPin,
  NotebookPen,
  Package,
  ShoppingCart,
  Truck,
  Wallet,
} from 'lucide-react';

export const nav = [
  ['dashboard', 'Resumen', LayoutDashboard],
  ['budget', 'Presupuestos', Calculator],
  ['orders', 'Compras', ShoppingCart],
  ['documents', 'Documentos', FileText],
  ['supply', 'Abastecimiento', Truck],
  ['forecast', 'Predicción y optimización', Activity],
  ['inventory', 'Almacén', Package],
  ['payments', 'Pagos', Wallet],
  ['logs', 'Bitácoras', NotebookPen],
  ['plans', 'Planos e incidencias', MapPin],
  ['changes', 'Cambios de obra', FileText],
  ['experience', 'Biblioteca de experiencia', Activity],
  ['materials', 'Catálogo de insumos', Layers],
] as const;
export type Page = (typeof nav)[number][0] | 'projects' | 'company' | 'team';
export type Dialog = { type: string; item?: any } | null;
