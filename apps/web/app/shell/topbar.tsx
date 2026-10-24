'use client';
import { Building2, ChevronDown, ChevronRight, LockKeyhole, LogOut, Menu } from 'lucide-react';
import { nav, Page } from '../shared/navigation';
import { ThemeSwitch } from '../theme-switch';
import type { Data } from '../types';
export function Topbar({
  go,
  setMobile,
  mobile,
  sidebarCollapsed,
  toggleSidebar,
  page,
  projectId,
  changeProject,
  data,
  setPasswordOpen,
  onLogout,
}: {
  go: (page: Page) => void;
  mobile: boolean;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setMobile: React.Dispatch<React.SetStateAction<boolean>>;
  page: Page;
  projectId: string;
  changeProject: (id: string) => void;
  data: Data;
  onLogout: () => Promise<void>;
  setPasswordOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const companyPage = page === 'company' || page === 'team';
  return (
    <header className="topbar">
      <div className="breadcrumb">
        <>
          <button
            className="mobile-menu icon-button"
            aria-label={mobile ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={mobile}
            aria-controls="workspace-sidebar"
            onClick={() => setMobile((value) => !value)}
          >
            <Menu />
          </button>
          <button
            className="desktop-menu icon-button"
            aria-label={sidebarCollapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'}
            title={sidebarCollapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'}
            aria-expanded={!sidebarCollapsed}
            aria-controls="workspace-sidebar"
            onClick={toggleSidebar}
          >
            <Menu size={20} />
          </button>
        </>
        <button
          className="text-button"
          onClick={() => go('company')}
          aria-current={page === 'company' ? 'page' : undefined}
        >
          Mi empresa
        </button>
        <ChevronRight size={14} />
        <strong>
          {page === 'projects'
            ? 'Todas las obras'
            : page === 'company'
              ? 'Administración'
              : page === 'team'
                ? 'Equipo y permisos'
                : nav.find((n) => n[0] === page)?.[1]}
        </strong>
      </div>
      <div className="top-right">
        {companyPage ? (
          <button className="secondary" onClick={() => go('projects')}>
            <Building2 size={15} /> Ver todas las obras
          </button>
        ) : (
          <label className="project-picker">
            <Building2 size={15} />
            <span className="picker-label">Cambiar obra</span>
            <select
              aria-label="Cambiar obra"
              value={projectId}
              onChange={(e) => changeProject(e.target.value)}
            >
              <option value="all">Ver todas las obras</option>
              {data.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.name}
                </option>
              ))}
            </select>
            <ChevronDown size={14} />
          </label>
        )}
        <ThemeSwitch />
        <button
          className="icon-button"
          aria-label="Cambiar mi contraseña"
          title="Cambiar mi contraseña"
          onClick={() => setPasswordOpen(true)}
        >
          <LockKeyhole size={17} />
        </button>
        {(page === 'projects' || companyPage) && (
          <button
            className="icon-button"
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            onClick={onLogout}
          >
            <LogOut size={17} />
          </button>
        )}
        <span className="top-avatar">{data.user.name.slice(0, 2).toUpperCase()}</span>
      </div>
    </header>
  );
}
