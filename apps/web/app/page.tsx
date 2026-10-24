'use client';
import { Building2, Check, Download, LoaderCircle, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AccessContext, canDo, permissionFor } from './access';
import { ChangesPanel } from './features/changes';
import { DocumentsPanel } from './features/documents';
import { ExperiencePanel } from './features/experience';
import { LogWorkspace } from './features/logs';
import { PlansPanel } from './features/plans';
import { SupplyDialog, supplyDialogTypes, SupplyPanel } from './features/supply';
import { PasswordForm, TeamPanel } from './features/team';
import { ForecastPanel } from './features/forecast/forecast-panel';
import { DialogContent } from './shell/dialog-content';
import { LogExportDialog } from './features/logs/log-export';
import { exportCurrent } from './shared/export-current';
import { useViewPreference } from './shared/use-view-preference';
import { Dialog, Page } from './shared/navigation';
import { restoreWorkspaceLocation, saveWorkspaceLocation } from './shared/workspace-location';
import { day, sumBudget, today } from './shared/presentation';
import { LoginScreen } from './shell/login-screen';
import { ProjectContext } from './shell/project-context';
import { Sidebar } from './shell/sidebar';
import { Topbar } from './shell/topbar';
import type { Data } from './types';
import { BudgetView } from './features/budget/budget-view';
import { DashboardView } from './features/dashboard/dashboard-view';
import { InventoryView } from './features/inventory/inventory-view';
import { LogsView } from './features/logs/logs-view';
import { MaterialsView } from './features/materials/materials-view';
import { OrdersView } from './features/orders/orders-view';
import { PaymentsView } from './features/payments/payments-view';
import { CompanyPanel } from './features/company/company-panel';
import { ProjectsView } from './features/projects/projects-view';

export default function Home() {
  const [passwordRequired, setPasswordRequired] = useState(false),
    [passwordOpen, setPasswordOpen] = useState(false);
  const [data, setData] = useState<Data | null>(null),
    [loading, setLoading] = useState(true),
    [logged, setLogged] = useState(false),
    [page, setPage] = useState<Page>('projects'),
    [projectId, setProjectId] = useState('all'),
    [dialog, setDialog] = useState<Dialog>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [toast, setToast] = useState(''),
    [mobile, setMobile] = useState(false);
  const [search, setSearch] = useViewPreference<string>(
    data?.user.id,
    page,
    projectId,
    'search',
    '',
  );
  const [filter, setFilter] = useViewPreference<string>(
    data?.user.id,
    page,
    projectId,
    'filter',
    'all',
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useViewPreference<boolean>(
    data?.user.id,
    'company',
    'all',
    'sidebarCollapsed',
    false,
  );
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pendingCommand = useRef<{ fingerprint: string; key: string } | null>(null);
  async function refresh() {
    const r = await fetch('/api/data', { cache: 'no-store' });
    if (r.status === 401) {
      setLogged(false);
      setData(null);
      return;
    }
    if (r.status === 403) {
      const issue = await r.json();
      if (issue.code === 'PASSWORD_CHANGE_REQUIRED') {
        setPasswordRequired(true);
        setData(null);
        return;
      }
      throw new Error(issue.message);
    }
    if (!r.ok)
      throw new Error('No se pudo cargar la información. Verifica que el servidor esté activo.');
    const fresh: Data = await r.json();
    if (data?.user.id !== fresh.user.id) {
      const location = restoreWorkspaceLocation(fresh);
      setPage(location.page);
      setProjectId(location.projectId);
      setDialog(null);
      setPasswordOpen(false);
    } else if (projectId !== 'all' && !fresh.projects.some((p) => p.id === projectId)) {
      setProjectId('all');
      setPage('projects');
    } else if (page === 'team' && !canDo(fresh.user.permissions, 'users')) {
      setPage('company');
    }
    setData(fresh);
    setPasswordRequired(false);
    setLogged(true);
  }
  useEffect(() => {
    refresh()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (logged && data) saveWorkspaceLocation(data.user.id, { page, projectId });
  }, [logged, data?.user.id, page, projectId]);
  useEffect(() => {
    if (!mobile) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobile(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobile]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(''), 4500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => {
    if (dialog) {
      dialogRef.current?.showModal();
      setError('');
    } else dialogRef.current?.close();
  }, [dialog]);
  async function mutate(path: string, body: unknown, success: string, keepOpen = false) {
    setBusy(true);
    setError('');
    try {
      const permission = permissionFor(path, body);
      if (permission && !canDo(data?.user.permissions, permission))
        throw new Error('Tu perfil no permite esta operación');
      const fingerprint = path + JSON.stringify(body);
      if (pendingCommand.current?.fingerprint !== fingerprint)
        pendingCommand.current = { fingerprint, key: crypto.randomUUID() };
      const r = await fetch('/api/' + path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': pendingCommand.current.key,
        },
        body: JSON.stringify(body),
      });
      const result = await r.json();
      if (!r.ok) {
        if (r.status === 401) {
          setLogged(false);
          setDialog(null);
        }
        throw new Error(result.message || 'No se pudo guardar');
      }
      await refresh();
      pendingCommand.current = null;
      if (path === 'logs') setDialog({ type: 'logDetail', item: result });
      else if (!keepOpen) setDialog(null);
      setToast(success);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function go(p: Page) {
    if (p === 'projects') setProjectId('all');
    setPage(p);
    setMobile(false);
    window.scrollTo({ top: 0 });
  }
  function changeProject(id: string) {
    setProjectId(id);
    if (id === 'all') setPage('projects');
    else if (['projects', 'company', 'team'].includes(page)) setPage('dashboard');
    setError('');
    setMobile(false);
    window.scrollTo({ top: 0 });
  }
  function openDialog(d: Dialog) {
    if (d) {
      const perms: Record<string, string> = {
        project: 'projects',
        material: 'materials',
        budget: 'budget',
        order: 'orders',
        receive: 'stock',
        consume: 'stock',
        pay: 'payments',
        log: 'logs',
        need: 'supply',
        cancelNeed: 'supply',
        release: 'stock',
        transfer: 'stock',
        receiveTransfer: 'stock',
      };
      const perm = d.type === 'confirm' ? permissionFor(d.item.path) : perms[d.type];
      if (perm && !can(perm)) {
        setError('Tu perfil no permite esta operación');
        return;
      }
    }
    setDialog(d);
  }
  function openProject(id: string) {
    changeProject(id);
    go('dashboard');
  }
  const allProjects = data?.projects || [];
  const projects = data?.projects.filter((p) => projectId === 'all' || p.id === projectId) || [];
  const orders = data?.orders.filter((o) => projectId === 'all' || o.projectId === projectId) || [];
  const stocks = data?.stocks.filter((s) => projectId === 'all' || s.projectId === projectId) || [];
  const logs = data?.logs.filter((l) => projectId === 'all' || l.projectId === projectId) || [];
  const selected = data?.projects.find((p) => p.id === projectId);
  const companyPage = page === 'company' || page === 'team';
  const standalonePage = page === 'projects' || companyPage;
  const globalPage = page === 'projects' || page === 'materials' || page === 'team';
  const can = (permission: string) => canDo(data?.user.permissions, permission);
  const matches = (...s: string[]) => s.join(' ').toLowerCase().includes(search.toLowerCase());
  const totalBudget = projects.reduce((n, p) => n + sumBudget(p), 0),
    due = orders.reduce((n, o) => n + Number(o.due), 0),
    paid = orders.reduce((n, o) => n + Number(o.paid), 0),
    committed = orders
      .filter((o) => !['DRAFT', 'CANCELLED'].includes(o.status))
      .reduce((n, o) => n + Number(o.committed), 0);
  const pageTitle = {
    company: 'Mi empresa',
    team: 'Equipo y permisos',
    forecast: 'Predicción y optimización',
    experience: 'Biblioteca de experiencia',
    documents: 'Captura de documentos',
    dashboard: 'Cada obra, bajo control.',
    projects: 'Tus obras',
    budget: 'Presupuestos',
    orders: 'Compras',
    supply: 'Abastecimiento',
    inventory: 'Almacén',
    payments: 'Pagos',
    changes: 'Cambios de obra',
    plans: 'Planos e incidencias',
    logs: 'Bitácoras de obra',
    materials: 'Catálogo de insumos',
  };
  const pageSub = {
    company: 'Administración general de la empresa y de las personas que colaboran en ella.',
    team: 'Administración de cuentas, perfiles y acceso a las obras de la empresa.',
    forecast: 'Anticipa faltantes y compara opciones con costos, fechas y fuentes.',
    experience: 'Aprende de lo ejecutado, con costos y rendimientos trazables.',
    documents: 'Del documento original a una compra revisada y trazable.',
    dashboard: 'Una vista clara de tus proyectos y lo que necesita tu atención.',
    projects: 'Selecciona una obra para abrir su espacio de trabajo y sus módulos.',
    budget: 'Construye el costo directo de cada concepto y fija tu línea base.',
    orders: 'De la orden al material recibido, sin perder el hilo.',
    supply: 'Anticipa faltantes y conecta los materiales de todas tus obras.',
    inventory: 'Existencias y movimientos de material por obra.',
    payments: 'Controla lo recibido, lo pagado y los saldos por cubrir.',
    changes: 'De la solicitud al acuerdo, con costo, plazo e historial.',
    plans: 'Ubica pendientes, conserva cada revisión y documenta su resolución.',
    logs: 'Lo que ocurre en campo queda registrado aquí.',
    materials: 'Una base común de materiales, mano de obra y equipo.',
  };

  if (loading)
    return (
      <div className="loading">
        <div className="brand-mark">
          <Building2 />
        </div>
        <LoaderCircle className="spin" />
        <p>Preparando tu espacio de trabajo…</p>
      </div>
    );
  if (passwordRequired)
    return (
      <main className="password-gate">
        <PasswordForm
          required
          onDone={() => {
            setPasswordRequired(false);
            setLogged(false);
            setData(null);
            setError('Contraseña actualizada. Inicia sesión de nuevo.');
          }}
          onCancel={async () => {
            await fetch('/api/auth/logout', { method: 'POST' });
            setPasswordRequired(false);
            setLogged(false);
            setData(null);
          }}
        />
      </main>
    );
  if (!logged || !data)
    return (
      <LoginScreen
        setBusy={setBusy}
        setError={setError}
        refresh={refresh}
        error={error}
        busy={busy}
      />
    );
  return (
    <AccessContext.Provider value={data.user.permissions || []}>
      <div className={'app-shell' + (sidebarCollapsed ? ' sidebar-collapsed' : '')}>
        <Sidebar
          mobile={mobile}
          standalone={standalonePage}
          onClose={() => setMobile(false)}
          go={go}
          can={can}
          page={page}
          orders={orders}
          setLogged={setLogged}
          setData={setData}
          data={data}
        />
        {mobile && (
          <button className="shade" aria-label="Cerrar menú" onClick={() => setMobile(false)} />
        )}
        <div className="main-shell">
          <Topbar
            go={go}
            mobile={mobile}
            sidebarCollapsed={sidebarCollapsed}
            toggleSidebar={() => setSidebarCollapsed((value) => !value)}
            setMobile={setMobile}
            page={page}
            projectId={projectId}
            changeProject={changeProject}
            data={data}
            setPasswordOpen={setPasswordOpen}
            onLogout={async () => {
              await fetch('/api/auth/logout', { method: 'POST' });
              setLogged(false);
              setData(null);
            }}
          />
          <main>
            {!standalonePage && (
              <ProjectContext selected={selected} globalPage={globalPage} page={page} go={go} />
            )}
            <div className="page-heading">
              <div>
                {page === 'dashboard' && (
                  <div className="eyebrow">
                    PANORAMA GENERAL <span> / {day(today())}</span>
                  </div>
                )}
                <h1>{page === 'dashboard' && selected ? 'Resumen de obra' : pageTitle[page]}</h1>
                <p>
                  {page === 'dashboard' && selected
                    ? `Presupuesto, compras y actividad de ${selected.name}.`
                    : pageSub[page]}
                </p>
              </div>
              <div className="heading-actions">
                {!['forecast', 'team', 'company'].includes(page) && (
                  <button
                    className="secondary"
                    onClick={() =>
                      exportCurrent({
                        data,
                        page,
                        openDialog,
                        projectId,
                        projects,
                        stocks,
                        orders,
                        allProjects,
                        setToast,
                      })
                    }
                  >
                    <Download size={16} />
                    <span>{page === 'logs' ? 'Exportar expediente PDF' : 'Exportar'}</span>
                  </button>
                )}
                {['dashboard', 'projects'].includes(page) && can('projects') ? (
                  <button className="primary" onClick={() => openDialog({ type: 'project' })}>
                    <Plus size={17} />
                    Nueva obra
                  </button>
                ) : ['budget', 'orders', 'logs', 'materials', 'supply'].includes(page) &&
                  can(page) ? (
                  <button
                    className="primary"
                    disabled={selected?.status === 'CLOSED' && !globalPage}
                    onClick={() =>
                      openDialog({
                        type:
                          page === 'budget'
                            ? 'budget'
                            : page === 'orders'
                              ? 'order'
                              : page === 'logs'
                                ? 'log'
                                : page === 'supply'
                                  ? 'need'
                                  : 'material',
                      })
                    }
                  >
                    <Plus size={17} />
                    {page === 'budget'
                      ? 'Nuevo concepto'
                      : page === 'orders'
                        ? 'Nueva compra'
                        : page === 'logs'
                          ? 'Nueva bitácora'
                          : page === 'supply'
                            ? 'Planificar material'
                            : 'Nuevo insumo'}
                  </button>
                ) : null}
              </div>
            </div>
            {error &&
              !dialog &&
              !['plans', 'changes', 'documents', 'experience'].includes(page) && (
                <div role="alert" className="error inline-error">
                  {error}
                  <button aria-label="Cerrar error" onClick={() => setError('')}>
                    <X size={16} />
                  </button>
                </div>
              )}
            {page === 'dashboard' && (
              <DashboardView
                projects={projects}
                totalBudget={totalBudget}
                committed={committed}
                due={due}
                go={go}
                orders={orders}
                openProject={openProject}
                logs={logs}
                openDialog={openDialog}
                paid={paid}
                stocks={stocks}
              />
            )}
            {page === 'projects' && (
              <ProjectsView
                search={search}
                setSearch={setSearch}
                filter={filter}
                setFilter={setFilter}
                allProjects={allProjects}
                matches={matches}
                selected={selected}
                openProject={openProject}
                can={can}
                openDialog={openDialog}
              />
            )}
            {page === 'budget' && (
              <BudgetView projects={projects} can={can} openDialog={openDialog} />
            )}
            {page === 'orders' && (
              <OrdersView
                search={search}
                setSearch={setSearch}
                filter={filter}
                setFilter={setFilter}
                orders={orders}
                matches={matches}
                openDialog={openDialog}
              />
            )}
            {page === 'supply' && (
              <SupplyPanel key={projectId} data={data} projectId={projectId} open={openDialog} />
            )}
            {page === 'inventory' && (
              <InventoryView
                stocks={stocks}
                search={search}
                setSearch={setSearch}
                matches={matches}
                can={can}
                openDialog={openDialog}
                data={data}
                projectId={projectId}
              />
            )}
            {page === 'payments' && (
              <PaymentsView
                orders={orders}
                paid={paid}
                due={due}
                can={can}
                openDialog={openDialog}
              />
            )}
            {passwordOpen && (
              <PasswordForm
                onDone={() => {
                  setPasswordOpen(false);
                  setLogged(false);
                  setData(null);
                  setError('Contraseña actualizada. Inicia sesión de nuevo.');
                }}
                onCancel={() => setPasswordOpen(false)}
              />
            )}
            {page === 'company' && <CompanyPanel data={data} go={go} />}
            {page === 'team' && can('users') && <TeamPanel data={data} />}
            {page === 'forecast' && (
              <ForecastPanel
                key={projectId}
                data={data}
                projectId={projectId}
                onSupply={(id) => {
                  changeProject(id);
                  go('supply');
                }}
              />
            )}
            {page === 'experience' && (
              <ExperiencePanel
                key={projectId}
                data={data}
                projectId={projectId}
                busy={busy}
                error={error}
                save={(p, b, m) => mutate(p, b, m, true)}
                refresh={async () => {
                  setError('');
                  try {
                    await refresh();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              />
            )}
            {page === 'documents' && (
              <DocumentsPanel
                key={projectId}
                data={data}
                projectId={projectId}
                busy={busy}
                error={error}
                save={(p, b, m) => mutate(p, b, m, true)}
                refresh={refresh}
              />
            )}
            {page === 'changes' && (
              <ChangesPanel
                key={projectId}
                data={data}
                projectId={projectId}
                busy={busy}
                error={error}
                save={(p, b, m) => mutate(p, b, m, true)}
                refresh={async () => {
                  setError('');
                  try {
                    await refresh();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              />
            )}
            {page === 'plans' && (
              <PlansPanel
                key={projectId}
                data={data}
                projectId={projectId}
                busy={busy}
                error={error}
                save={(p, b, m) => mutate(p, b, m, true)}
                setBusy={setBusy}
                refresh={async () => {
                  setError('');
                  try {
                    await refresh();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              />
            )}
            {page === 'logs' && (
              <LogsView
                search={search}
                setSearch={setSearch}
                filter={filter}
                setFilter={setFilter}
                logs={logs}
                matches={matches}
                openDialog={openDialog}
              />
            )}
            {page === 'materials' && (
              <MaterialsView
                search={search}
                setSearch={setSearch}
                filter={filter}
                setFilter={setFilter}
                data={data}
                matches={matches}
              />
            )}
            <footer className="footer">
              <span>
                {data.user.roleLabel} ·{' '}
                {data.user.role === 'ADMIN' ? 'Acceso global' : 'Solo obras asignadas'}
              </span>
              <span>
                <span className="live-dot" />
                Guardado en PostgreSQL local
              </span>
              <span>Obra · Primera versión funcional</span>
            </footer>
          </main>
        </div>
        {toast && (
          <div className="toast" role="status">
            <Check size={18} />
            {toast}
          </div>
        )}
        <dialog
          className={dialog?.type === 'logDetail' ? 'log-dialog' : ''}
          ref={dialogRef}
          onCancel={(e) => {
            if (busy) e.preventDefault();
            else setDialog(null);
          }}
          onClick={(e) => {
            if (e.target === dialogRef.current && !busy) setDialog(null);
          }}
        >
          <div className="dialog-inner">
            <button
              className="dialog-close icon-button"
              aria-label="Cerrar ventana"
              disabled={busy}
              onClick={() => openDialog(null)}
            >
              <X size={20} />
            </button>
            {dialog &&
              (dialog.type === 'logExport' ? (
                <LogExportDialog
                  data={data}
                  projectId={projectId}
                  busy={busy}
                  setBusy={setBusy}
                  close={() => setDialog(null)}
                />
              ) : dialog.type === 'logDetail' ? (
                <LogWorkspace
                  key={dialog.item.id}
                  log={data.logs.find((l) => l.id === dialog.item.id) || dialog.item}
                  busy={busy}
                  error={error}
                  save={(p, b, m) => mutate(p, b, m, true)}
                  setBusy={setBusy}
                  transcription={data.capabilities.transcription}
                />
              ) : supplyDialogTypes.includes(dialog.type) ? (
                <SupplyDialog
                  dialog={dialog}
                  data={data}
                  projectId={projectId}
                  busy={busy}
                  error={error}
                  mutate={mutate}
                  close={() => setDialog(null)}
                />
              ) : (
                <DialogContent
                  key={dialog.type + (dialog.item?.id || '')}
                  dialog={dialog}
                  data={data}
                  projectId={projectId}
                  busy={busy}
                  error={error}
                  mutate={mutate}
                  open={openDialog}
                  close={() => setDialog(null)}
                />
              ))}
          </div>
        </dialog>
      </div>
    </AccessContext.Provider>
  );
}
