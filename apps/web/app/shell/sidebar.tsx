'use client';
import { Building2, LogOut, Users, X } from 'lucide-react';
import { nav, Page } from '../shared/navigation';
import type { Data, Order } from '../types';
export function Sidebar({
  mobile,
  standalone,
  onClose,
  go,
  can,
  page,
  orders,
  setLogged,
  setData,
  data,
}: {
  mobile: boolean;
  standalone: boolean;
  onClose: () => void;
  go: (p: Page) => void;
  can: (permission: string) => boolean;
  page: Page;
  orders: Order[];
  setLogged: React.Dispatch<React.SetStateAction<boolean>>;
  setData: React.Dispatch<React.SetStateAction<Data | null>>;
  data: Data;
}) {
  return (
    <aside
      id="workspace-sidebar"
      aria-label="Menú principal"
      className={'sidebar ' + (mobile ? 'visible' : '')}
    >
      <a
        className="brand"
        onClick={() => go(standalone ? 'projects' : 'dashboard')}
        href="#"
        aria-label="Obra · Inicio"
      >
        <span className="brand-mark">
          <Building2 size={23} />
        </span>
        <span className="sidebar-label">
          obra<span className="brand-dot">.</span>
        </span>
      </a>
      <button
        className="sidebar-mobile-close icon-button"
        aria-label="Cerrar menú lateral"
        onClick={onClose}
      >
        <X size={20} />
      </button>
      <button
        type="button"
        className="workspace company-workspace"
        onClick={() => go('company')}
        aria-label="Abrir Mi empresa"
      >
        <div className="company-avatar">ME</div>
        <div className="sidebar-label">
          <strong>Mi empresa</strong>
          <span>Administración de la empresa</span>
        </div>
        <span className="workspace-dot" />
      </button>
      <span className="nav-label">{standalone ? 'MI EMPRESA' : 'MÓDULOS DE LA OBRA'}</span>
      <nav>
        {standalone && (
          <>
            <button
              title="Todas las obras"
              aria-label="Todas las obras"
              className={page === 'projects' ? 'active' : ''}
              aria-current={page === 'projects' ? 'page' : undefined}
              onClick={() => go('projects')}
            >
              <Building2 size={19} />
              <span className="sidebar-label">Todas las obras</span>
            </button>
            {can('users') && (
              <button
                title="Equipo y permisos"
                aria-label="Equipo y permisos"
                className={page === 'team' ? 'active' : ''}
                aria-current={page === 'team' ? 'page' : undefined}
                onClick={() => go('team')}
              >
                <Users size={19} />
                <span className="sidebar-label">Equipo y permisos</span>
              </button>
            )}
          </>
        )}
        {!standalone &&
          nav.map(([key, label, Icon]) => (
            <button
              key={key}
              title={label}
              aria-label={label}
              className={page === key ? 'active' : ''}
              aria-current={page === key ? 'page' : undefined}
              onClick={() => go(key)}
            >
              <Icon size={19} />
              <span className="sidebar-label">{label}</span>
              {key === 'orders' && orders.filter((o) => o.status === 'DRAFT').length > 0 && (
                <span className="nav-count">
                  {orders.filter((o) => o.status === 'DRAFT').length}
                </span>
              )}
            </button>
          ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="pilot">
          <span className="pilot-dot" />
          <strong>Primera versión</strong>
          <p>Datos de demostración · uso local</p>
        </div>
        <button
          className="profile"
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
          onClick={async () => {
            await fetch('/api/auth/logout', { method: 'POST' });
            setLogged(false);
            setData(null);
          }}
        >
          <span className="avatar">{data.user.name.slice(0, 2).toUpperCase()}</span>
          <span className="sidebar-label">
            <strong>{data.user.name}</strong>
            <small>Cerrar sesión</small>
          </span>
          <LogOut size={17} />
        </button>
      </div>
    </aside>
  );
}
