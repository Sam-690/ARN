'use client';
import { Building2, ChevronRight, Layers, MapPin, Search } from 'lucide-react';
import type { Order, Project } from '../types';

export const labels: Record<string, string> = {
  ACTIVE: 'En ejecución',
  CLOSED: 'Cerrada',
  DRAFT: 'Borrador',
  APPROVED: 'Aprobada',
  PARTIAL: 'Recepción parcial',
  RECEIVED: 'Recibida',
  CANCELLED: 'Cancelada',
  MATERIAL: 'Material',
  LABOR: 'Mano de obra',
  EQUIPMENT: 'Equipo',
};
export const money = (n: number | string) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 2,
  }).format(Number(n));
export const compact = (n: number) =>
  new Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
export const qty = (n: number | string) =>
  new Intl.NumberFormat('es-MX', { maximumFractionDigits: 4 }).format(Number(n));
export const day = (s: string) =>
  new Date(s.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
export const eventDay = (s: string) =>
  new Date(s).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Mexico_City',
  });
export const today = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
export const sumBudget = (p: Project) =>
  p.budgetItems.reduce(
    (n, i) => n + Math.round(Number(i.quantity) * Number(i.unitPrice) * 100) / 100,
    0,
  );
export function Badge({ status }: { status: string }) {
  return (
    <span className={'badge ' + status.toLowerCase()}>
      <i />
      {labels[status] || status}
    </span>
  );
}
export function Empty({ title, description }: { title: string; description: string }) {
  return (
    <div className="empty">
      <Layers size={28} />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Stat({
  label,
  value,
  icon,
  detail,
  accent = false,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  detail: string;
  accent?: boolean;
}) {
  return (
    <div className={'stat ' + (accent ? 'stat-accent' : '')}>
      <div>
        <span>{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      <p>
        {accent && <span className="orange-dot" />}
        {detail}
      </p>
    </div>
  );
}
export function ProjectRow({
  p,
  index,
  orders,
  onClick,
}: {
  p: Project;
  index: number;
  orders: Order[];
  onClick: () => void;
}) {
  const b = Number(p.changeSummary.adjustedBudget),
    received = orders
      .filter((o) => o.projectId === p.id)
      .reduce((n, o) => n + Number(o.received), 0);
  return (
    <button className="project-row" onClick={onClick}>
      <div className={'project-symbol symbol-' + (index % 3)}>
        <Building2 size={24} />
      </div>
      <div className="project-row-info">
        <span>{p.code}</span>
        <h3>{p.name}</h3>
        <p>
          <MapPin size={12} />
          {p.location}
        </p>
      </div>
      <div className="project-row-value">
        <strong>{money(b)}</strong>
        <span>Presupuesto ajustado</span>
        <div className="progress">
          <i style={{ width: Math.max(0, Math.min(100, b ? (received / b) * 100 : 0)) + '%' }} />
        </div>
        <small>
          {b ? ((received / b) * 100).toLocaleString('es-MX', { maximumFractionDigits: 1 }) : '0'}%
          recibido / presupuesto
        </small>
      </div>
      <ChevronRight size={18} />
    </button>
  );
}
export function Attention({
  icon,
  title,
  count,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  description: string;
  onClick: () => void;
}) {
  return (
    <button className="attention-row" onClick={onClick}>
      <span className="attention-icon">{icon}</span>
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <b>{count}</b>
      <ChevronRight size={14} />
    </button>
  );
}
export function Resource({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  return (
    <div className="resource">
      <div>
        <span>{label}</span>
        <strong>{money(value)}</strong>
      </div>
      <div className={'resource-bar ' + color}>
        <i
          style={{
            width: Math.max(value ? 2 : 0, Math.min(100, max ? (value / max) * 100 : 0)) + '%',
          }}
        />
      </div>
    </div>
  );
}
export function Toolbar({
  search,
  onSearch,
  placeholder,
  children,
}: {
  search: string;
  onSearch: (s: string) => void;
  placeholder: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="toolbar">
      <label className="search">
        <Search size={17} />
        <input
          aria-label={placeholder}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={placeholder}
        />
      </label>
      <div>{children}</div>
    </div>
  );
}
