'use client';
import { useEffect, useState, FormEvent, useRef } from 'react';
import {
  LayoutDashboard,
  Building2,
  Calculator,
  ShoppingCart,
  Package,
  Wallet,
  NotebookPen,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRight,
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  MapPin,
  CalendarDays,
  Check,
  CheckCheck,
  X,
  LogOut,
  LoaderCircle,
  AlertCircle,
  Download,
  LockKeyhole,
  Menu,
  HardHat,
  Users,
  CloudSun,
  FileText,
  Activity,
  Trash2,
  Truck,
} from 'lucide-react';
import { AccessContext, canDo, permissionFor, useCan } from './access';
import { TeamPanel, PasswordForm } from './team-panel';
import { ForecastPanel } from './forecast-panel';
import { ExperiencePanel } from './experience-panel';
import { DocumentsPanel } from './documents-panel';
import { ChangesPanel, BudgetAdjustment, changeLabels } from './changes-panel';
import { PlansPanel } from './plans-panel';
import { LogExportDialog } from './log-export';
import { LogWorkspace } from './log-workspace';
import { SupplyPanel, SupplyDialog, supplyDialogTypes } from './supply-panel';
import { ThemeSwitch } from './theme-switch';
import type { Data, Project, Order, Stock, Log } from './types';
const nav = [
  ['dashboard', 'Resumen', LayoutDashboard],
  ['projects', 'Obras', Building2],
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
  ['team', 'Equipo y permisos', Users],
] as const;
type Page = (typeof nav)[number][0];
type Dialog = { type: string; item?: any } | null;
const labels: Record<string, string> = {
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
const money = (n: number | string) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 2,
  }).format(Number(n));
const compact = (n: number) =>
  new Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
const qty = (n: number | string) =>
  new Intl.NumberFormat('es-MX', { maximumFractionDigits: 4 }).format(Number(n));
const day = (s: string) =>
  new Date(s.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
const eventDay = (s: string) =>
  new Date(s).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Mexico_City',
  });
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
function Badge({ status }: { status: string }) {
  return (
    <span className={'badge ' + status.toLowerCase()}>
      <i />
      {labels[status] || status}
    </span>
  );
}
function Empty({ title, description }: { title: string; description: string }) {
  return (
    <div className="empty">
      <Layers size={28} />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
const sumBudget = (p: Project) =>
  p.budgetItems.reduce(
    (n, i) => n + Math.round(Number(i.quantity) * Number(i.unitPrice) * 100) / 100,
    0,
  );
function download(name: string, headers: string[], rows: (string | number)[][]) {
  const cell = (v: string | number) => {
    let t = String(v);
    if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
    return '"' + t.replaceAll('"', '""') + '"';
  };
  const csv = '\uFEFF' + [headers, ...rows].map((row) => row.map(cell).join(',')).join('\r\n');
  const u = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = u;
  a.download = name;
  a.click();
  URL.revokeObjectURL(u);
}
export default function Home() {
  const [passwordRequired, setPasswordRequired] = useState(false),
    [passwordOpen, setPasswordOpen] = useState(false);
  const [data, setData] = useState<Data | null>(null),
    [loading, setLoading] = useState(true),
    [logged, setLogged] = useState(false),
    [page, setPage] = useState<Page>('dashboard'),
    [projectId, setProjectId] = useState('all'),
    [search, setSearch] = useState(''),
    [dialog, setDialog] = useState<Dialog>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [toast, setToast] = useState(''),
    [mobile, setMobile] = useState(false),
    [filter, setFilter] = useState('all');
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
    const fresh = await r.json();
    if (data?.user.id !== fresh.user.id) {
      setPage('dashboard');
      setProjectId('all');
      setDialog(null);
      setPasswordOpen(false);
    }
    setData(fresh);
    setPasswordRequired(false);
    setLogged(true);
    if (projectId !== 'all' && !fresh.projects.some((p: Project) => p.id === projectId))
      setProjectId('all');
  }
  useEffect(() => {
    refresh()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    setSearch('');
    setFilter('all');
  }, [page, projectId]);
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
    setPage(p);
    setMobile(false);
    window.scrollTo({ top: 0 });
  }
  function changeProject(id: string) {
    setProjectId(id);
    setSearch('');
    setFilter('all');
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
    team: 'Personas, perfiles y obras autorizadas.',
    forecast: 'Anticipa faltantes y compara opciones con costos, fechas y fuentes.',
    experience: 'Aprende de lo ejecutado, con costos y rendimientos trazables.',
    documents: 'Del documento original a una compra revisada y trazable.',
    dashboard: 'Una vista clara de tus proyectos y lo que necesita tu atención.',
    projects: 'Organiza proyectos, equipos y presupuestos en un solo lugar.',
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
  function exportCurrent() {
    if (!data) return;
    if (page === 'logs') {
      openDialog({ type: 'logExport' });
      return;
    }
    if (page === 'experience')
      download(
        'experiencia.csv',
        [
          'Registro',
          'Obra',
          'Concepto',
          'Frente',
          'Inicio',
          'Fin',
          'Cantidad',
          'Unidad',
          'Cobertura',
          'Costo registrado',
          'Costo unitario',
          'Estado',
          'Prueba',
          'Grupo',
          'Versión',
        ],
        data.experience.records
          .filter((r) => projectId === 'all' || r.projectId === projectId)
          .map((r) => [
            'EXP-' + r.number,
            r.project.name,
            r.budgetSnapshot.name,
            r.front,
            r.startDate.slice(0, 10),
            r.endDate.slice(0, 10),
            r.quantity,
            r.family.unit,
            r.coverage,
            r.metrics.recordedCost,
            r.metrics.unitCost,
            r.status,
            r.isTest ? 'Sí' : 'No',
            r.family.code,
            r.family.version,
          ]),
      );
    else if (page === 'documents')
      download(
        'documentos.csv',
        ['Documento', 'Obra', 'Archivo', 'Estado', 'Proveedor', 'Folio', 'Compra'],
        data.documents
          .filter((d) => projectId === 'all' || d.projectId === projectId)
          .map((d) => [
            'DOC-' + d.number,
            data.projects.find((p) => p.id === d.projectId)?.name || '',
            d.name,
            d.status,
            d.reviewed?.supplier || '',
            d.reviewed?.folio || '',
            data.orders.find((o) => o.id === d.orderId)?.number || '',
          ]),
      );
    else if (page === 'changes')
      download(
        'cambios-obra.csv',
        [
          'Folio',
          'Obra',
          'Título',
          'Estado',
          'Revisión',
          'Variación costo',
          'Variación cliente',
          'Días',
          'Avance %',
          'Aplicado',
          'Saldo',
        ],
        data.changes
          .filter((c) => projectId === 'all' || c.projectId === projectId)
          .map((c) => [
            'CAM-' + c.number,
            c.project.name,
            c.title,
            changeLabels[c.status],
            c.proposals[0].number,
            c.proposals[0].costDelta,
            c.proposals[0].priceDelta,
            c.proposals[0].daysDelta,
            c.progress,
            c.applied,
            c.outstanding,
          ]),
      );
    else if (page === 'plans') {
      const ds = data.drawings.filter((d) => projectId === 'all' || d.projectId === projectId);
      download(
        'incidencias-planos.csv',
        [
          'Obra',
          'Plano',
          'Versión',
          'Página',
          'Incidencia',
          'Título',
          'Responsable',
          'Vencimiento',
          'Estado',
          'Prioridad',
        ],
        ds.flatMap((d) =>
          d.versions.flatMap((v) =>
            data.planIssues
              .filter((i) => i.versionId === v.id)
              .map((i) => [
                d.project.name,
                d.code,
                v.number,
                i.page,
                'INC-' + i.number,
                i.title,
                i.assignee,
                i.dueDate.slice(0, 10),
                i.status,
                i.priority,
              ]),
          ),
        ),
      );
    } else if (page === 'supply')
      download(
        'abastecimiento.csv',
        [
          'Obra',
          'Material',
          'Unidad',
          'Actividad',
          'Cantidad',
          'Consumido',
          'Fecha necesaria',
          'Plazo días',
          'Estado',
          'Faltante previsto',
        ],
        data.needs
          .filter((n) => projectId === 'all' || n.projectId === projectId)
          .map((n) => [
            n.project.name,
            n.material.name,
            n.material.unit,
            n.purpose,
            n.quantity,
            n.consumed,
            n.neededOn.slice(0, 10),
            n.leadDays,
            n.status,
            data.coverage.find((c) => c.needId === n.id)?.shortage || '0',
          ]),
      );
    else if (page === 'budget')
      download(
        'presupuesto.csv',
        ['Obra', 'Clave', 'Concepto', 'Unidad', 'Cantidad', 'Precio unitario', 'Importe'],
        projects.flatMap((p) =>
          p.budgetItems.map((i) => [
            p.name,
            i.code,
            i.name,
            i.unit,
            i.quantity,
            i.unitPrice,
            (Number(i.quantity) * Number(i.unitPrice)).toFixed(2),
          ]),
        ),
      );
    else if (page === 'inventory')
      download(
        'inventario.csv',
        ['Obra', 'Insumo', 'Unidad', 'Existencia', 'Costo promedio'],
        stocks.map((s) => [
          s.project.name,
          s.material.name,
          s.material.unit,
          s.quantity,
          s.averageCost,
        ]),
      );
    else if (page === 'materials')
      download(
        'insumos.csv',
        ['Clave', 'Descripción', 'Tipo', 'Unidad', 'Precio'],
        data.materials.map((m) => [m.code, m.name, labels[m.type], m.unit, m.price]),
      );
    else if (page === 'orders' || page === 'payments')
      download(
        'compras-pagos.csv',
        ['Orden', 'Obra', 'Proveedor', 'Total', 'Recibido', 'Pagado', 'Por pagar', 'Estado'],
        orders.map((o) => [
          'OC-' + o.number,
          o.project.name,
          o.supplier,
          o.total,
          o.received,
          o.paid,
          o.due,
          labels[o.status],
        ]),
      );
    else
      download(
        'obras.csv',
        [
          'Clave',
          'Obra',
          'Cliente',
          'Responsable',
          'Estado',
          'Línea base',
          'Cambios aprobados',
          'Presupuesto ajustado',
          'Término base',
          'Término ajustado',
        ],
        (page === 'projects' ? allProjects : projects).map((p) => [
          p.code,
          p.name,
          p.client,
          p.manager,
          labels[p.status],
          p.changeSummary.baseBudget,
          p.changeSummary.approvedCostDelta,
          p.changeSummary.adjustedBudget,
          p.endDate.slice(0, 10),
          p.changeSummary.adjustedEndDate.slice(0, 10),
        ]),
      );
    setToast('Archivo CSV exportado');
  }
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
      <div className="login">
        <div className="login-art">
          <div className="brand">
            <span className="brand-mark">
              <Building2 />
            </span>
            obra<span className="brand-dot">.</span>
          </div>
          <span className="eyebrow light">CONTROL QUE CONSTRUYE</span>
          <h1>
            De la primera idea
            <br />a la última entrega.
          </h1>
          <p>
            Tus proyectos, materiales y decisiones.
            <br />
            Todo conectado en un mismo lugar.
          </p>
          <div className="building-art">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
          <span className="login-foot">Una empresa. Todas tus obras.</span>
        </div>
        <div className="login-form">
          <ThemeSwitch />
          <span className="eyebrow">TU ESPACIO DE TRABAJO</span>
          <h2>Bienvenido a Obra</h2>
          <p>Inicia sesión para continuar.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              const f = new FormData(e.currentTarget);
              try {
                const r = await fetch('/api/auth/login', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(Object.fromEntries(f)),
                });
                if (!r.ok) throw new Error((await r.json()).message);
                await refresh();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Correo electrónico">
              <input
                name="email"
                type="email"
                required
                defaultValue="admin@obra.local"
                autoComplete="username"
              />
            </Field>
            <Field label="Contraseña">
              <input name="password" type="password" required autoComplete="current-password" />
            </Field>
            {error && (
              <div role="alert" className="error">
                {error}
              </div>
            )}
            <button className="primary full" disabled={busy}>
              {busy ? <LoaderCircle className="spin" size={17} /> : <ArrowRight size={17} />}Entrar
              al espacio
            </button>
          </form>
          <div className="demo-note">
            <LockKeyhole size={18} />
            <div>
              <strong>Acceso del equipo</strong>
              <p>Solicita una cuenta y tus obras asignadas a administración.</p>
            </div>
          </div>
        </div>
      </div>
    );
  return (
    <AccessContext.Provider value={data.user.permissions || []}>
      <div className="app-shell">
        <aside className={'sidebar ' + (mobile ? 'visible' : '')}>
          <a className="brand" onClick={() => go('dashboard')} href="#">
            <span className="brand-mark">
              <Building2 size={23} />
            </span>
            obra<span className="brand-dot">.</span>
          </a>
          <div className="workspace">
            <div className="company-avatar">ME</div>
            <div>
              <strong>Mi empresa</strong>
              <span>Control de construcción</span>
            </div>
            <span className="workspace-dot" />
          </div>
          <span className="nav-label">ESPACIO DE TRABAJO</span>
          <nav>
            {nav
              .filter(([key]) => key !== 'team' || can('users'))
              .map(([key, label, Icon]) => (
                <button
                  key={key}
                  className={page === key ? 'active' : ''}
                  aria-current={page === key ? 'page' : undefined}
                  onClick={() => go(key)}
                >
                  <Icon size={19} />
                  {label}
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
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST' });
                setLogged(false);
                setData(null);
              }}
            >
              <span className="avatar">{data.user.name.slice(0, 2).toUpperCase()}</span>
              <span>
                <strong>{data.user.name}</strong>
                <small>Cerrar sesión</small>
              </span>
              <LogOut size={17} />
            </button>
          </div>
        </aside>
        {mobile && (
          <button className="shade" aria-label="Cerrar menú" onClick={() => setMobile(false)} />
        )}
        <div className="main-shell">
          <header className="topbar">
            <div className="breadcrumb">
              <button
                className="mobile-menu icon-button"
                aria-label="Abrir menú"
                onClick={() => setMobile(true)}
              >
                <Menu />
              </button>
              <span>Mi empresa</span>
              <ChevronRight size={14} />
              <strong>{nav.find((n) => n[0] === page)?.[1]}</strong>
            </div>
            <div className="top-right">
              <label className="project-picker">
                <Building2 size={15} />
                <span className="picker-label">Cambiar obra</span>
                <select
                  aria-label="Cambiar obra"
                  value={projectId}
                  onChange={(e) => changeProject(e.target.value)}
                >
                  <option value="all">Todas las obras</option>
                  {data.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} · {p.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </label>
              <ThemeSwitch />
              <button
                className="icon-button"
                aria-label="Cambiar mi contraseña"
                title="Cambiar mi contraseña"
                onClick={() => setPasswordOpen(true)}
              >
                <LockKeyhole size={17} />
              </button>
              <span className="top-avatar">{data.user.name.slice(0, 2).toUpperCase()}</span>
            </div>
          </header>
          <main>
            <section
              className={'project-context ' + (selected ? 'is-selected' : '')}
              aria-label="Contexto de obra"
            >
              <div className="context-identity">
                <span className="context-icon">
                  <Building2 size={22} />
                </span>
                <div>
                  <span className="eyebrow">
                    {selected ? 'OBRA DE TRABAJO' : 'VISTA DE LA EMPRESA'}
                  </span>
                  <strong>
                    {selected ? `${selected.code} · ${selected.name}` : 'Todas las obras'}
                  </strong>
                  <p>
                    {globalPage
                      ? page === 'projects'
                        ? 'Este listado siempre muestra todas tus obras. Abre una para ver su resumen.'
                        : page === 'team'
                          ? 'Administración global de cuentas y acceso por obra.'
                          : 'Catálogo compartido por todas las obras de la empresa.'
                      : selected
                        ? `${selected.location} · ${selected.status === 'CLOSED' ? 'Obra cerrada · consulta de registros' : 'Los datos de este módulo corresponden a esta obra.'}`
                        : 'Los datos de este módulo reúnen todas tus obras.'}
                  </p>
                </div>
              </div>
              <div className="context-actions">
                {selected && <Badge status={selected.status} />}
                <button className="secondary" onClick={() => go('projects')}>
                  Ver todas las obras <ArrowRight size={14} />
                </button>
                {selected && (
                  <button className="text-button" onClick={() => changeProject('all')}>
                    Quitar selección <X size={14} />
                  </button>
                )}
              </div>
            </section>
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
                {!['forecast', 'team'].includes(page) && (
                  <button className="secondary" onClick={exportCurrent}>
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
              <>
                <div className="stats">
                  <Stat
                    label="Obras en ejecución"
                    value={String(projects.filter((p) => p.status === 'ACTIVE').length).padStart(
                      2,
                      '0',
                    )}
                    icon={<Building2 />}
                    detail={`${projects.length} proyectos en tu espacio`}
                  />
                  <Stat
                    label="Línea base directa"
                    value={money(totalBudget)}
                    icon={<Calculator />}
                    detail="Suma de conceptos registrados"
                  />
                  <Stat
                    label="Compromiso pendiente"
                    value={money(committed)}
                    icon={<ShoppingCart />}
                    detail="Material aprobado por recibir"
                  />
                  <Stat
                    label="Saldo por pagar"
                    value={money(due)}
                    icon={<Wallet />}
                    detail="Sobre material recibido"
                    accent
                  />
                </div>
                {projects.some((p) => p.changeSummary.approvedCount > 0) && (
                  <section className="panel dashboard-adjustments">
                    <div className="panel-head">
                      <div>
                        <h2>Presupuesto con cambios aprobados</h2>
                        <p>
                          La línea base se conserva; los ajustes provienen de solicitudes
                          autorizadas.
                        </p>
                      </div>
                      <button className="text-button" onClick={() => go('changes')}>
                        Ver cambios <ArrowRight size={15} />
                      </button>
                    </div>
                    {projects
                      .filter((p) => p.changeSummary.approvedCount > 0)
                      .map((p) => (
                        <div key={p.id}>
                          <strong>
                            {p.code} · {p.name}
                          </strong>
                          <BudgetAdjustment project={p} />
                        </div>
                      ))}
                  </section>
                )}
                <div className="dashboard-grid">
                  <section className="panel projects-panel">
                    <div className="panel-head">
                      <div>
                        <h2>
                          Obras en movimiento{' '}
                          <span className="count">
                            {projects.filter((p) => p.status === 'ACTIVE').length}
                          </span>
                        </h2>
                        <p>Presupuesto y control de cada proyecto</p>
                      </div>
                      <button className="text-button" onClick={() => go('projects')}>
                        Ver todas <ArrowRight size={15} />
                      </button>
                    </div>
                    <div className="project-list">
                      {projects
                        .filter((p) => p.status === 'ACTIVE')
                        .map((p, i) => (
                          <ProjectRow
                            key={p.id}
                            p={p}
                            index={i}
                            orders={orders}
                            onClick={() => openProject(p.id)}
                          />
                        ))}
                      {projects.length === 0 && (
                        <Empty
                          title="Tu primera obra empieza aquí"
                          description="Crea un proyecto para conectar su presupuesto y operación."
                        />
                      )}
                    </div>
                  </section>
                  <section className="panel attention-panel">
                    <div className="panel-head">
                      <div>
                        <h2>Por atender</h2>
                        <p>Lo importante, a la vista</p>
                      </div>
                      <span className="attention-dot" />
                    </div>
                    <Attention
                      icon={<ShoppingCart />}
                      title="Compras por aprobar"
                      count={orders.filter((o) => o.status === 'DRAFT').length}
                      description="Revisa las órdenes en borrador"
                      onClick={() => go('orders')}
                    />
                    <Attention
                      icon={<Wallet />}
                      title="Pagos pendientes"
                      count={orders.filter((o) => Number(o.due) > 0).length}
                      description={`${money(due)} por cubrir`}
                      onClick={() => go('payments')}
                    />
                    <Attention
                      icon={<NotebookPen />}
                      title="Bitácoras por cerrar"
                      count={logs.filter((l) => l.status === 'DRAFT').length}
                      description="Completa el registro de campo"
                      onClick={() => go('logs')}
                    />
                    <div className="attention-note">
                      <CheckCheck size={19} />
                      <p>
                        Cada registro conserva
                        <br />
                        su historial de actividad.
                      </p>
                    </div>
                  </section>
                </div>
                <div className="dashboard-grid bottom-grid">
                  <section className="panel">
                    <div className="panel-head">
                      <div>
                        <h2>Últimas bitácoras</h2>
                        <p>El pulso de tus obras</p>
                      </div>
                      <button className="text-button" onClick={() => go('logs')}>
                        Ver bitácoras <ArrowRight size={15} />
                      </button>
                    </div>
                    {logs.slice(0, 3).map((l) => (
                      <button
                        key={l.id}
                        className="log-preview"
                        onClick={() => openDialog({ type: 'logDetail', item: l })}
                      >
                        <div className="date-tile">
                          <strong>{new Date(l.date).getUTCDate()}</strong>
                          <span>
                            {new Date(l.date).toLocaleDateString('es-MX', {
                              month: 'short',
                              timeZone: 'UTC',
                            })}
                          </span>
                        </div>
                        <div>
                          <h3>{l.title}</h3>
                          <p>{l.project.name}</p>
                        </div>
                        <Badge status={l.status} />
                        <ChevronRight size={17} />
                      </button>
                    ))}
                    {!logs.length && (
                      <Empty
                        title="Sin bitácoras todavía"
                        description="Registra la primera actividad de campo."
                      />
                    )}
                  </section>
                  <section className="panel">
                    <div className="panel-head">
                      <div>
                        <h2>Distribución de recursos</h2>
                        <p>Importes independientes · MXN</p>
                      </div>
                      <Activity size={18} />
                    </div>
                    <div className="resource-summary">
                      <Resource
                        label="Recibido en materiales"
                        value={orders.reduce((n, o) => n + Number(o.received), 0)}
                        max={totalBudget}
                        color="teal"
                      />
                      <Resource
                        label="Pagado a proveedores"
                        value={paid}
                        max={totalBudget}
                        color="blue"
                      />
                      <Resource
                        label="Inventario disponible"
                        value={stocks.reduce(
                          (n, s) => n + Number(s.quantity) * Number(s.averageCost),
                          0,
                        )}
                        max={totalBudget}
                        color="orange"
                      />
                      <p className="small-note">
                        Las compras, el inventario y los pagos representan etapas distintas. Estos
                        importes no se suman.
                      </p>
                    </div>
                  </section>
                </div>
              </>
            )}
            {page === 'projects' && (
              <>
                <Toolbar
                  search={search}
                  onSearch={setSearch}
                  placeholder="Buscar obra, clave o responsable…"
                >
                  <select
                    aria-label="Estado de obra"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="all">Todos los estados</option>
                    <option value="ACTIVE">En ejecución</option>
                    <option value="CLOSED">Cerradas</option>
                  </select>
                </Toolbar>
                <div className="project-cards">
                  {allProjects
                    .filter(
                      (p) =>
                        (filter === 'all' || p.status === filter) &&
                        matches(p.name, p.code, p.manager),
                    )
                    .map((p, i) => (
                      <article
                        key={p.id}
                        className={
                          'project-card ' + (selected?.id === p.id ? 'project-card-selected' : '')
                        }
                      >
                        <div className={'project-cover cover-' + (i % 3)}>
                          <div className="blueprint" />
                          <span>{p.code}</span>
                          <Building2 size={44} strokeWidth={1} />
                        </div>
                        <div className="project-card-body">
                          <div className="project-card-status">
                            <Badge status={p.status} />
                            {selected?.id === p.id && (
                              <span className="selected-label">
                                <Check size={12} />
                                Obra seleccionada
                              </span>
                            )}
                          </div>
                          <h2>{p.name}</h2>
                          <p>
                            <MapPin size={14} />
                            {p.location}
                          </p>
                          <div className="card-budget">
                            <span>Presupuesto ajustado</span>
                            <strong>{money(p.changeSummary.adjustedBudget)}</strong>
                          </div>
                          <div className="card-meta">
                            <span>
                              <Users size={14} />
                              {p.manager}
                            </span>
                            <span>
                              <CalendarDays size={14} />
                              {day(p.changeSummary.adjustedEndDate)}
                            </span>
                          </div>
                          <div className="card-actions">
                            <button className="text-button" onClick={() => openProject(p.id)}>
                              Ver resumen <ArrowRight size={15} />
                            </button>
                            {p.status === 'ACTIVE' && (
                              <button
                                className="subtle"
                                disabled={!can('projects')}
                                onClick={() =>
                                  openDialog({
                                    type: 'confirm',
                                    item: {
                                      path: `projects/${p.id}/close`,
                                      title: 'Cerrar obra',
                                      message:
                                        'El proyecto conservará su historial y no admitirá nuevos movimientos. No puede tener compras, inventario, pagos, bitácoras, abastecimiento, traspasos, incidencias o cambios pendientes.',
                                    },
                                  })
                                }
                              >
                                Cerrar obra
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    ))}
                </div>
                {!allProjects.filter(
                  (p) =>
                    (filter === 'all' || p.status === filter) && matches(p.name, p.code, p.manager),
                ).length && (
                  <Empty
                    title="No se encontraron obras"
                    description="Cambia los filtros o crea un nuevo proyecto."
                  />
                )}
              </>
            )}
            {page === 'budget' && (
              <>
                <div className="section-note">
                  <Calculator size={20} />
                  <p>
                    <strong>Costo directo por concepto.</strong> Esta versión calcula la suma de
                    insumos × cantidades. Los cambios aprobados se muestran por separado de la línea
                    base. Indirectos e impuestos siguen pendientes.
                  </p>
                </div>
                {projects.map((p) => (
                  <section className="panel budget-panel" key={p.id}>
                    <div className="panel-head">
                      <div>
                        <span className="eyebrow">{p.code}</span>
                        <h2>{p.name}</h2>
                      </div>
                      <div className="heading-actions">
                        {p.budgetApproved ? (
                          <span className="locked">
                            <LockKeyhole size={14} />
                            Línea base aprobada
                          </span>
                        ) : (
                          <button
                            disabled={
                              !can('approveBudget') ||
                              !p.budgetItems.length ||
                              p.status === 'CLOSED'
                            }
                            className="secondary"
                            onClick={() =>
                              openDialog({
                                type: 'confirm',
                                item: {
                                  path: `projects/${p.id}/approve-budget`,
                                  title: 'Aprobar presupuesto',
                                  message:
                                    'El presupuesto quedará congelado. Los ajustes posteriores se tramitan desde Cambios de obra, conservando esta línea base.',
                                },
                              })
                            }
                          >
                            <Check size={15} />
                            Aprobar presupuesto
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Clave / concepto</th>
                            <th>Unidad</th>
                            <th className="numeric">Cantidad</th>
                            <th className="numeric">Precio unitario</th>
                            <th className="numeric">Importe</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {p.budgetItems.map((i) => (
                            <tr key={i.id}>
                              <td>
                                <small>{i.code}</small>
                                <strong>{i.name}</strong>
                              </td>
                              <td>{i.unit}</td>
                              <td className="numeric">{qty(i.quantity)}</td>
                              <td className="numeric">{money(i.unitPrice)}</td>
                              <td className="numeric strong">
                                {money(Number(i.quantity) * Number(i.unitPrice))}
                              </td>
                              <td>
                                <button
                                  className="text-button"
                                  onClick={() => openDialog({ type: 'apu', item: i })}
                                >
                                  Ver análisis
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {!p.budgetItems.length && (
                      <Empty
                        title="Presupuesto por construir"
                        description="Agrega el primer concepto con sus insumos."
                      />
                    )}
                    <div className="table-total">
                      <span>{p.budgetItems.length} conceptos · MXN</span>
                      <strong>
                        Total directo <b>{money(sumBudget(p))}</b>
                      </strong>
                    </div>
                    <BudgetAdjustment project={p} />
                  </section>
                ))}
              </>
            )}
            {page === 'orders' && (
              <>
                <Toolbar
                  search={search}
                  onSearch={setSearch}
                  placeholder="Buscar proveedor, orden u obra…"
                >
                  <select
                    aria-label="Estado de compra"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="all">Todos los estados</option>
                    {['DRAFT', 'APPROVED', 'PARTIAL', 'RECEIVED', 'CANCELLED'].map((s) => (
                      <option value={s} key={s}>
                        {labels[s]}
                      </option>
                    ))}
                  </select>
                </Toolbar>
                <section className="panel">
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Orden / proveedor</th>
                          <th>Obra</th>
                          <th>Entrega esperada</th>
                          <th className="numeric">Importe</th>
                          <th>Estado</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {orders
                          .filter(
                            (o) =>
                              (filter === 'all' || o.status === filter) &&
                              matches(o.supplier, 'OC-' + o.number, o.project.name),
                          )
                          .map((o) => (
                            <tr key={o.id}>
                              <td>
                                <small>OC-{String(o.number).padStart(4, '0')}</small>
                                <strong>{o.supplier}</strong>
                              </td>
                              <td>{o.project.name}</td>
                              <td>{day(o.expectedDate)}</td>
                              <td className="numeric strong">{money(o.total)}</td>
                              <td>
                                <Badge status={o.status} />
                              </td>
                              <td>
                                <button
                                  className="text-button"
                                  onClick={() => openDialog({ type: 'orderDetail', item: o })}
                                >
                                  Abrir <ArrowUpRight size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  {!orders.filter(
                    (o) =>
                      (filter === 'all' || o.status === filter) &&
                      matches(o.supplier, 'OC-' + o.number, o.project.name),
                  ).length && (
                    <Empty
                      title="Sin compras para mostrar"
                      description="Crea una orden o ajusta los filtros."
                    />
                  )}
                </section>
              </>
            )}
            {page === 'supply' && (
              <SupplyPanel key={projectId} data={data} projectId={projectId} open={openDialog} />
            )}
            {page === 'inventory' && (
              <>
                <div className="mini-stats">
                  <div>
                    <span>Material en almacén</span>
                    <strong>
                      {stocks.filter((s) => Number(s.quantity) > 0).length} existencias
                    </strong>
                  </div>
                  <div>
                    <span>Valor del inventario</span>
                    <strong>
                      {money(
                        stocks.reduce((n, s) => n + Number(s.quantity) * Number(s.averageCost), 0),
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>Valuación</span>
                    <strong>Promedio ponderado</strong>
                  </div>
                </div>
                <Toolbar
                  search={search}
                  onSearch={setSearch}
                  placeholder="Buscar material u obra…"
                />
                <section className="panel">
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Material</th>
                          <th>Almacén de obra</th>
                          <th className="numeric">Existencia</th>
                          <th className="numeric">Costo promedio</th>
                          <th className="numeric">Valor</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {stocks
                          .filter((s) => matches(s.material.name, s.project.name))
                          .map((s) => (
                            <tr key={s.id}>
                              <td>
                                <small>{s.material.code}</small>
                                <strong>{s.material.name}</strong>
                              </td>
                              <td>{s.project.name}</td>
                              <td className="numeric">
                                {qty(s.quantity)} <span className="muted">{s.material.unit}</span>
                                <small>{qty(s.released)} liberados para traspaso</small>
                              </td>
                              <td className="numeric">{money(s.averageCost)}</td>
                              <td className="numeric strong">
                                {money(Number(s.quantity) * Number(s.averageCost))}
                              </td>
                              <td>
                                <button
                                  className="text-button"
                                  disabled={
                                    !can('stock') ||
                                    Number(s.quantity) - Number(s.released) <= 0 ||
                                    s.project.status === 'CLOSED'
                                  }
                                  onClick={() => openDialog({ type: 'consume', item: s })}
                                >
                                  Registrar salida <ArrowUpRight size={14} />
                                </button>
                                <br />
                                <button
                                  className="text-button"
                                  disabled={
                                    !can('stock') ||
                                    Number(s.quantity) <= 0 ||
                                    s.project.status === 'CLOSED'
                                  }
                                  onClick={() => openDialog({ type: 'release', item: s })}
                                >
                                  Declarar sobrante
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  {!stocks.filter((s) => matches(s.material.name, s.project.name)).length && (
                    <Empty
                      title="No hay existencias"
                      description="Recibe material desde una orden de compra aprobada."
                    />
                  )}
                </section>
                <section className="panel budget-panel">
                  <div className="panel-head">
                    <div>
                      <h2>Kardex reciente</h2>
                      <p>Últimos 100 movimientos de la empresa</p>
                    </div>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Movimiento</th>
                          <th>Material / obra</th>
                          <th>Referencia</th>
                          <th className="numeric">Cantidad</th>
                          <th>Fecha</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.movements
                          .filter(
                            (m) =>
                              (projectId === 'all' || m.projectId === projectId) &&
                              matches(m.material.name, m.project.name),
                          )
                          .map((m) => (
                            <tr key={m.id}>
                              <td>
                                <span className={'movement ' + m.type}>
                                  {['IN', 'TRANSFER_IN'].includes(m.type) ? (
                                    <ArrowDownLeft size={16} />
                                  ) : (
                                    <ArrowUpRight size={16} />
                                  )}{' '}
                                  {['IN', 'TRANSFER_IN'].includes(m.type)
                                    ? m.type === 'TRANSFER_IN'
                                      ? 'Traspaso recibido'
                                      : 'Entrada'
                                    : m.type === 'TRANSFER_OUT'
                                      ? 'Traspaso enviado'
                                      : 'Salida'}
                                </span>
                              </td>
                              <td>
                                <strong>{m.material.name}</strong>
                                <small>{m.project.name}</small>
                              </td>
                              <td>{m.reference}</td>
                              <td className="numeric">
                                {qty(m.quantity)} {m.material.unit}
                              </td>
                              <td>{eventDay(m.createdAt)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}
            {page === 'payments' && (
              <>
                <div className="mini-stats">
                  <div>
                    <span>Material recibido</span>
                    <strong>{money(orders.reduce((n, o) => n + Number(o.received), 0))}</strong>
                  </div>
                  <div>
                    <span>Pagos registrados</span>
                    <strong>{money(paid)}</strong>
                  </div>
                  <div>
                    <span>Saldo por pagar</span>
                    <strong className="orange-text">{money(due)}</strong>
                  </div>
                </div>
                <div className="section-note">
                  <Wallet size={20} />
                  <p>
                    Registro interno de pagos contra material recibido, sin ejecución bancaria. La
                    gestión de facturas, impuestos y anticipos está pendiente.
                  </p>
                </div>
                <section className="panel">
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Proveedor / orden</th>
                          <th>Obra</th>
                          <th className="numeric">Recibido</th>
                          <th className="numeric">Pagado</th>
                          <th className="numeric">Pendiente</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {orders
                          .filter((o) => Number(o.received) > 0)
                          .map((o) => (
                            <tr key={o.id}>
                              <td>
                                <strong>{o.supplier}</strong>
                                <small>OC-{String(o.number).padStart(4, '0')}</small>
                              </td>
                              <td>{o.project.name}</td>
                              <td className="numeric">{money(o.received)}</td>
                              <td className="numeric">{money(o.paid)}</td>
                              <td className="numeric strong">{money(o.due)}</td>
                              <td>
                                {Number(o.due) > 0 ? (
                                  <button
                                    className="text-button"
                                    disabled={!can('payments')}
                                    onClick={() => openDialog({ type: 'pay', item: o })}
                                  >
                                    Registrar pago <ArrowUpRight size={14} />
                                  </button>
                                ) : (
                                  <span className="paid-label">
                                    <CheckCheck size={16} />
                                    Al corriente
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </section>
                <section className="panel budget-panel">
                  <div className="panel-head">
                    <div>
                      <h2>Historial de pagos</h2>
                      <p>Referencias registradas por el equipo</p>
                    </div>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Proveedor</th>
                          <th>Referencia</th>
                          <th>Método</th>
                          <th className="numeric">Importe</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.flatMap((o) =>
                          o.payments.map((p) => (
                            <tr key={p.id}>
                              <td>{day(p.paidAt)}</td>
                              <td>{o.supplier}</td>
                              <td>{p.reference}</td>
                              <td>{p.method}</td>
                              <td className="numeric strong">{money(p.amount)}</td>
                            </tr>
                          )),
                        )}
                      </tbody>
                    </table>
                  </div>
                  {!orders.some((o) => o.payments.length) && (
                    <Empty
                      title="Sin pagos registrados"
                      description="Los pagos que captures aparecerán aquí."
                    />
                  )}
                </section>
              </>
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
              <>
                <Toolbar
                  search={search}
                  onSearch={setSearch}
                  placeholder="Buscar actividad, obra o responsable…"
                >
                  <select
                    aria-label="Estado de bitácora"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="all">Todas las bitácoras</option>
                    <option value="DRAFT">Borradores</option>
                    <option value="CLOSED">Cerradas</option>
                  </select>
                </Toolbar>
                <div className="log-cards">
                  {logs
                    .filter(
                      (l) =>
                        (filter === 'all' || l.status === filter) &&
                        matches(l.title, l.project.name, l.author, l.activities),
                    )
                    .map((l) => (
                      <article className="panel log-card" key={l.id}>
                        <div className="log-card-top">
                          <span>
                            <CalendarDays size={15} />
                            {day(l.date)}
                          </span>
                          <Badge status={l.status} />
                        </div>
                        <span className="eyebrow">{l.project.name}</span>
                        <h2>{l.title}</h2>
                        <p className="clamp">{l.activities}</p>
                        <p className="small-note">
                          {l.front && <>{l.front} · </>}
                          {l.attachments.length} archivos · {l.addenda.length} adendas
                        </p>
                        {l.incident && (
                          <div className="incident">
                            <AlertCircle size={15} />
                            <span>1 pendiente registrado</span>
                          </div>
                        )}
                        <div className="log-card-bottom">
                          <span>
                            <Users size={15} />
                            {l.crew} personas
                          </span>
                          <button
                            className="text-button"
                            onClick={() => openDialog({ type: 'logDetail', item: l })}
                          >
                            Leer bitácora <ArrowRight size={15} />
                          </button>
                        </div>
                      </article>
                    ))}
                </div>
                {!logs.filter(
                  (l) =>
                    (filter === 'all' || l.status === filter) &&
                    matches(l.title, l.project.name, l.author, l.activities),
                ).length && (
                  <Empty
                    title="Sin bitácoras para mostrar"
                    description="Agrega un registro de campo o cambia los filtros."
                  />
                )}
              </>
            )}
            {page === 'materials' && (
              <>
                <Toolbar search={search} onSearch={setSearch} placeholder="Buscar insumo o clave…">
                  <select
                    aria-label="Tipo de insumo"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="all">Todos los tipos</option>
                    {['MATERIAL', 'LABOR', 'EQUIPMENT'].map((s) => (
                      <option key={s} value={s}>
                        {labels[s]}
                      </option>
                    ))}
                  </select>
                </Toolbar>
                <section className="panel">
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Clave</th>
                          <th>Descripción</th>
                          <th>Tipo</th>
                          <th>Unidad</th>
                          <th className="numeric">Precio de referencia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.materials
                          .filter(
                            (m) =>
                              (filter === 'all' || m.type === filter) && matches(m.name, m.code),
                          )
                          .map((m) => (
                            <tr key={m.id}>
                              <td>
                                <span className="code">{m.code}</span>
                              </td>
                              <td className="strong">{m.name}</td>
                              <td>{labels[m.type]}</td>
                              <td>{m.unit}</td>
                              <td className="numeric">{money(m.price)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  {!data.materials.filter(
                    (m) => (filter === 'all' || m.type === filter) && matches(m.name, m.code),
                  ).length && (
                    <Empty
                      title="Sin insumos para mostrar"
                      description="Agrega un insumo o cambia los filtros."
                    />
                  )}
                </section>
              </>
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
function Stat({
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
function ProjectRow({
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
function Attention({
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
function Resource({
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
function Toolbar({
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
function DialogContent({
  dialog,
  data,
  projectId,
  busy,
  error,
  mutate,
  open,
  close,
}: {
  dialog: NonNullable<Dialog>;
  data: Data;
  projectId: string;
  busy: boolean;
  error: string;
  mutate: (path: string, body: unknown, message: string) => Promise<boolean>;
  open: (d: Dialog) => void;
  close: () => void;
}) {
  const can = useCan();
  const [components, setComponents] = useState([{ name: '', quantity: 1, price: 0 }]);
  const [orderLines, setOrderLines] = useState([
    {
      materialId:
        dialog.item?.materialId || data.materials.find((m) => m.type === 'MATERIAL')?.id || '',
      quantity: dialog.item?.quantity || 1,
      unitPrice: Number(
        data.materials.find((m) => m.id === dialog.item?.materialId)?.price ||
          data.materials.find((m) => m.type === 'MATERIAL')?.price ||
          0,
      ),
    },
  ]);
  const [formProject, setFormProject] = useState(
    dialog.item?.projectId ||
      (projectId === 'all'
        ? data.projects.find((p) => p.status === 'ACTIVE')?.id || ''
        : projectId),
  );
  const [volume, setVolume] = useState(1);
  const [receiveLine, setReceiveLine] = useState('');
  const { type, item } = dialog;
  const active = data.projects.filter(
    (p) => p.status === 'ACTIVE' && (type !== 'budget' || !p.budgetApproved),
  );
  const chosen = active.some((p) => p.id === formProject) ? formProject : active[0]?.id || '';
  const title: Record<string, string> = {
    project: 'Nueva obra',
    material: 'Nuevo insumo',
    budget: 'Nuevo concepto',
    order: 'Nueva orden de compra',
    consume: 'Registrar salida',
    pay: 'Registrar pago',
    log: 'Nueva bitácora',
    orderDetail: `Orden OC-${String(item?.number || 0).padStart(4, '0')}`,
    logDetail: 'Bitácora de obra',
    confirm: item?.title,
    apu: 'Análisis de precio unitario',
    receive: 'Recibir material',
  };
  const sub: Record<string, string> = {
    project: 'Un nuevo proyecto, conectado a toda tu operación.',
    material: 'Define la unidad y el precio de referencia.',
    budget: 'Calcula el costo directo a partir de sus componentes.',
    order: 'La orden se guardará en borrador para su aprobación.',
    consume: 'Registra material utilizado en esta obra.',
    pay: 'Captura un pago realizado fuera de la plataforma.',
    log: 'Documenta las actividades y pendientes del día.',
    receive: 'La recepción actualiza las existencias y el saldo por pagar.',
  };
  const errors = error ? (
    <div role="alert" className="error">
      {error}
    </div>
  ) : null;
  const actions = (label = 'Guardar', disabled = false) => (
    <div className="dialog-actions">
      <button type="button" className="secondary" onClick={close} disabled={busy}>
        Cancelar
      </button>
      <button type="submit" className="primary" disabled={busy || disabled}>
        {busy ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />} {label}
      </button>
    </div>
  );
  const projectSelect = (
    <Field label="Obra">
      <select
        name="projectId"
        value={chosen}
        onChange={(e) => setFormProject(e.target.value)}
        required
      >
        {!active.length && <option value="">No hay obras disponibles</option>}
        {active.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </Field>
  );
  function values(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    return Object.fromEntries(new FormData(e.currentTarget));
  }
  return (
    <>
      <span className="eyebrow">OBRA / {type.includes('Detail') ? 'DETALLE' : 'REGISTRO'}</span>
      <h2>{title[type]}</h2>
      {sub[type] && <p className="dialog-sub">{sub[type]}</p>}
      {type === 'project' && (
        <form
          onSubmit={(e) => {
            const v = values(e);
            mutate('projects', v, 'Obra creada correctamente');
          }}
        >
          <div className="form-grid">
            <Field label="Clave">
              <input name="code" placeholder="OB-004" maxLength={24} required />
            </Field>
            <Field label="Nombre de la obra">
              <input name="name" placeholder="Nombre del proyecto" maxLength={200} required />
            </Field>
            <Field label="Cliente">
              <input name="client" required maxLength={200} />
            </Field>
            <Field label="Responsable">
              <input name="manager" defaultValue={data.user.name} required maxLength={200} />
            </Field>
            <Field label="Ubicación">
              <input name="location" placeholder="Ciudad, estado" required maxLength={200} />
            </Field>
            <Field label="Fecha de inicio">
              <input name="startDate" type="date" defaultValue={today()} required />
            </Field>
            <Field label="Fecha de término">
              <input name="endDate" type="date" required />
            </Field>
          </div>
          {errors}
          {actions('Crear obra')}
        </form>
      )}
      {type === 'material' && (
        <form onSubmit={(e) => mutate('materials', values(e), 'Insumo agregado al catálogo')}>
          <div className="form-grid">
            <Field label="Clave">
              <input name="code" required maxLength={24} />
            </Field>
            <Field label="Tipo">
              <select name="type">
                <option value="MATERIAL">Material</option>
                <option value="LABOR">Mano de obra</option>
                <option value="EQUIPMENT">Equipo</option>
              </select>
            </Field>
            <Field label="Descripción">
              <input name="name" required maxLength={200} />
            </Field>
            <Field label="Unidad">
              <input name="unit" placeholder="m², bulto, jor…" required maxLength={16} />
            </Field>
            <Field label="Precio de referencia (MXN)">
              <input
                name="price"
                type="number"
                min="0.0001"
                step="0.0001"
                max="100000000"
                required
              />
            </Field>
          </div>
          {errors}
          {actions('Agregar insumo')}
        </form>
      )}
      {type === 'budget' && (
        <form
          onSubmit={(e) =>
            mutate('budget', { ...values(e), components }, 'Concepto agregado al presupuesto')
          }
        >
          {projectSelect}
          {!active.length && (
            <p className="small-note">
              Crea una obra o usa una con presupuesto sin aprobar para agregar conceptos.
            </p>
          )}
          <div className="form-grid">
            <Field label="Clave del concepto">
              <input name="code" required maxLength={24} />
            </Field>
            <Field label="Descripción">
              <input name="name" required maxLength={200} />
            </Field>
            <Field label="Unidad">
              <input name="unit" required maxLength={16} placeholder="m²" />
            </Field>
            <Field label="Volumen de obra">
              <input
                name="quantity"
                type="number"
                step="0.0001"
                min="0.0001"
                max="100000000"
                value={volume || ''}
                onChange={(e) => setVolume(Number(e.target.value))}
                required
              />
            </Field>
          </div>
          <div className="form-section">
            <h3>Componentes por unidad de concepto</h3>
            <p>Usa consumos por unidad. Ejemplo: 0.15 jornadas por m².</p>
            {components.map((c, i) => (
              <div className="component-row" key={i}>
                <Field label="Insumo">
                  <input
                    aria-label={`Insumo ${i + 1}`}
                    list="catalog-options"
                    value={c.name}
                    maxLength={200}
                    required
                    onChange={(e) => {
                      const m = data.materials.find((m) => m.name === e.target.value);
                      setComponents((prev) =>
                        prev.map((x, j) =>
                          j === i
                            ? { ...x, name: e.target.value, price: m ? Number(m.price) : x.price }
                            : x,
                        ),
                      );
                    }}
                  />
                </Field>
                <Field label="Consumo">
                  <input
                    aria-label={`Consumo ${i + 1}`}
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    value={c.quantity || ''}
                    required
                    onChange={(e) =>
                      setComponents((prev) =>
                        prev.map((x, j) =>
                          j === i ? { ...x, quantity: Number(e.target.value) } : x,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Precio">
                  <input
                    aria-label={`Precio ${i + 1}`}
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    value={c.price || ''}
                    required
                    onChange={(e) =>
                      setComponents((prev) =>
                        prev.map((x, j) => (j === i ? { ...x, price: Number(e.target.value) } : x)),
                      )
                    }
                  />
                </Field>
                <button
                  className="icon-button"
                  type="button"
                  aria-label={`Quitar componente ${i + 1}`}
                  disabled={components.length === 1}
                  onClick={() => setComponents((prev) => prev.filter((_, j) => j !== i))}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <datalist id="catalog-options">
              {data.materials.map((m) => (
                <option key={m.id} value={m.name}>
                  {m.unit} · {money(m.price)}
                </option>
              ))}
            </datalist>
            <button
              type="button"
              className="text-button"
              onClick={() =>
                setComponents((prev) => [...prev, { name: '', quantity: 1, price: 0 }])
              }
            >
              <Plus size={15} />
              Agregar componente
            </button>
          </div>
          <div className="calculation">
            <span>
              Precio unitario directo{' '}
              <b>{money(components.reduce((n, c) => n + c.quantity * c.price, 0))}</b>
            </span>
            <span>
              Importe estimado{' '}
              <b>{money(components.reduce((n, c) => n + c.quantity * c.price, 0) * volume)}</b>
            </span>
          </div>
          {errors}
          {actions('Guardar concepto', !chosen)}
        </form>
      )}
      {type === 'order' && (
        <form
          onSubmit={(e) =>
            mutate('orders', { ...values(e), lines: orderLines }, 'Orden guardada en borrador')
          }
        >
          {projectSelect}
          <div className="form-grid">
            <Field label="Proveedor">
              <input name="supplier" required maxLength={200} placeholder="Nombre o razón social" />
            </Field>
            <Field label="Entrega esperada">
              <input
                name="expectedDate"
                type="date"
                defaultValue={item?.expectedDate || today()}
                required
              />
            </Field>
          </div>
          <div className="form-section">
            <h3>Materiales de la orden</h3>
            {orderLines.map((l, i) => (
              <div className="component-row" key={i}>
                <Field label="Material">
                  <select
                    aria-label={`Material ${i + 1}`}
                    required
                    value={l.materialId}
                    onChange={(e) => {
                      const m = data.materials.find((m) => m.id === e.target.value);
                      setOrderLines((prev) =>
                        prev.map((x, j) =>
                          i === j
                            ? { ...x, materialId: e.target.value, unitPrice: Number(m?.price || 0) }
                            : x,
                        ),
                      );
                    }}
                  >
                    {!data.materials.some((m) => m.type === 'MATERIAL') && (
                      <option value="">Agrega materiales al catálogo</option>
                    )}
                    {data.materials
                      .filter((m) => m.type === 'MATERIAL')
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.unit})
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Cantidad">
                  <input
                    aria-label={`Cantidad ${i + 1}`}
                    type="number"
                    required
                    min="0.0001"
                    step="0.0001"
                    value={l.quantity || ''}
                    onChange={(e) =>
                      setOrderLines((prev) =>
                        prev.map((x, j) =>
                          i === j ? { ...x, quantity: Number(e.target.value) } : x,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Precio unitario">
                  <input
                    aria-label={`Precio unitario ${i + 1}`}
                    type="number"
                    required
                    min="0.0001"
                    step="0.0001"
                    value={l.unitPrice || ''}
                    onChange={(e) =>
                      setOrderLines((prev) =>
                        prev.map((x, j) =>
                          i === j ? { ...x, unitPrice: Number(e.target.value) } : x,
                        ),
                      )
                    }
                  />
                </Field>
                <button
                  className="icon-button"
                  type="button"
                  aria-label={`Quitar material ${i + 1}`}
                  disabled={orderLines.length === 1}
                  onClick={() => setOrderLines((prev) => prev.filter((_, j) => i !== j))}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="text-button"
              onClick={() =>
                setOrderLines((prev) => [
                  ...prev,
                  {
                    materialId: data.materials.find((m) => m.type === 'MATERIAL')?.id || '',
                    quantity: 1,
                    unitPrice: Number(
                      data.materials.find((m) => m.type === 'MATERIAL')?.price || 0,
                    ),
                  },
                ])
              }
            >
              <Plus size={15} />
              Agregar material
            </button>
          </div>
          <div className="calculation">
            <span>
              Total directo{' '}
              <b>{money(orderLines.reduce((n, l) => n + l.quantity * l.unitPrice, 0))}</b>
            </span>
          </div>
          <p className="small-note">
            Importes sin impuestos. Esta versión admite compras de materiales, no servicios.
          </p>
          {errors}
          {actions('Crear orden', !chosen || !orderLines[0]?.materialId)}
        </form>
      )}
      {type === 'orderDetail' && (
        <>
          <div className="detail-heading">
            <div>
              <h3>{item.supplier}</h3>
              <p>
                {item.project.name} · Entrega: {day(item.expectedDate)}
              </p>
            </div>
            <Badge status={item.status} />
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Material</th>
                  <th className="numeric">Pedido</th>
                  <th className="numeric">Recibido</th>
                  <th className="numeric">Precio</th>
                </tr>
              </thead>
              <tbody>
                {(item as Order).lines.map((l) => (
                  <tr key={l.id}>
                    <td>
                      {l.material.name}
                      <small>{l.material.unit}</small>
                    </td>
                    <td className="numeric">{qty(l.quantity)}</td>
                    <td className="numeric">{qty(l.received)}</td>
                    <td className="numeric">{money(l.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="calculation">
            <span>
              Total <b>{money(item.total)}</b>
            </span>
            <span>
              Pagado <b>{money(item.paid)}</b>
            </span>
            <span>
              Por pagar sobre recibido <b>{money(item.due)}</b>
            </span>
          </div>
          {errors}
          <div className="dialog-actions wrap-actions">
            {['DRAFT', 'APPROVED'].includes(item.status) && (
              <button
                className="danger-text"
                disabled={busy || !can('orders')}
                onClick={() =>
                  open({
                    type: 'confirm',
                    item: {
                      path: `orders/${item.id}/cancel`,
                      title: 'Cancelar compra',
                      message: 'La orden se conservará en el historial como cancelada.',
                    },
                  })
                }
              >
                Cancelar compra
              </button>
            )}
            {item.status === 'DRAFT' && (
              <button
                className="primary"
                disabled={busy || !can('approveOrder')}
                onClick={() =>
                  open({
                    type: 'confirm',
                    item: {
                      path: `orders/${item.id}/approve`,
                      title: 'Aprobar compra',
                      message: `Se autorizará la orden por ${money(item.total)}. En esta primera versión la autorización la realiza el administrador y no valida un límite presupuestal.`,
                    },
                  })
                }
              >
                <Check size={16} />
                Aprobar orden
              </button>
            )}
            {['APPROVED', 'PARTIAL'].includes(item.status) && (
              <button
                className="primary"
                disabled={!can('stock')}
                onClick={() => open({ type: 'receive', item })}
              >
                <Package size={16} />
                Recibir material
              </button>
            )}
            {Number(item.due) > 0 && (
              <button
                className="secondary"
                disabled={!can('payments')}
                onClick={() => open({ type: 'pay', item })}
              >
                Registrar pago
              </button>
            )}
          </div>
        </>
      )}
      {type === 'receive' &&
        (() => {
          const pending = (item as Order).lines.filter(
            (l) => Number(l.received) < Number(l.quantity),
          );
          const l = pending.find((x) => x.id === receiveLine) || pending[0];
          return (
            <form
              onSubmit={(e) =>
                mutate(
                  `orders/${item.id}/receive`,
                  values(e),
                  'Recepción registrada; almacén actualizado',
                )
              }
            >
              <Field label="Partida">
                <select
                  name="lineId"
                  value={l?.id || ''}
                  onChange={(e) => setReceiveLine(e.target.value)}
                  required
                >
                  {pending.map((x) => (
                    <option value={x.id} key={x.id}>
                      {x.material.name} · Pendiente: {qty(Number(x.quantity) - Number(x.received))}{' '}
                      {x.material.unit}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Cantidad recibida">
                <input
                  key={l?.id}
                  name="quantity"
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  max={l ? Number(l.quantity) - Number(l.received) : 0}
                  defaultValue={l ? Number(l.quantity) - Number(l.received) : 0}
                  required
                />
              </Field>
              <Field label="Referencia de entrega">
                <input
                  name="reference"
                  required
                  maxLength={200}
                  placeholder="Remisión o nota de entrega"
                />
              </Field>
              {errors}
              {actions('Confirmar recepción')}
            </form>
          );
        })()}
      {type === 'consume' && (
        <form
          onSubmit={(e) => {
            const v = values(e);
            mutate(
              'stock/consume',
              {
                ...v,
                needId: v.needId || undefined,
                projectId: item.projectId,
                materialId: item.materialId,
              },
              'Salida de material registrada',
            );
          }}
        >
          <div className="detail-box">
            <strong>{item.material.name}</strong>
            <p>
              {item.project.name} · Utilizable: {qty(Number(item.quantity) - Number(item.released))}{' '}
              {item.material.unit}
            </p>
          </div>
          <Field label={`Cantidad a utilizar (${item.material.unit})`}>
            <input
              name="quantity"
              type="number"
              min="0.0001"
              step="0.0001"
              max={Number(item.quantity) - Number(item.released)}
              required
            />
          </Field>
          <Field label="Necesidad que atiende">
            <select name="needId" defaultValue={item.needId || ''}>
              <option value="">Consumo sin necesidad planificada</option>
              {data.needs
                .filter(
                  (n) =>
                    n.status === 'OPEN' &&
                    n.projectId === item.projectId &&
                    n.materialId === item.materialId,
                )
                .map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.purpose} · Pendiente: {qty(Number(n.quantity) - Number(n.consumed))}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Destino / referencia de los trabajos">
            <input
              name="reference"
              required
              maxLength={200}
              placeholder="Ej. Cimentación, frente A"
            />
          </Field>
          {errors}
          {actions('Confirmar salida')}
        </form>
      )}
      {type === 'pay' && (
        <form
          onSubmit={(e) =>
            mutate(`orders/${item.id}/pay`, values(e), 'Pago registrado correctamente')
          }
        >
          <div className="detail-box">
            <strong>{item.supplier}</strong>
            <p>
              OC-{item.number} · {item.project.name}
            </p>
            <span>
              Saldo recibido por pagar: <b>{money(item.due)}</b>
            </span>
          </div>
          <div className="form-grid">
            <Field label="Importe pagado (MXN)">
              <input name="amount" type="number" min="0.01" step="0.01" max={item.due} required />
            </Field>
            <Field label="Fecha del pago">
              <input name="paidAt" type="date" defaultValue={today()} required />
            </Field>
            <Field label="Método">
              <select name="method">
                <option>Transferencia</option>
                <option>Efectivo</option>
                <option>Cheque</option>
              </select>
            </Field>
            <Field label="Referencia / folio">
              <input name="reference" required maxLength={200} />
            </Field>
          </div>
          <p className="small-note">
            Esta acción solo registra el pago. No mueve dinero ni envía instrucciones a un banco.
          </p>
          {errors}
          {actions('Guardar pago')}
        </form>
      )}
      {type === 'log' && (
        <form
          onSubmit={(e) => {
            const v = values(e);
            mutate(
              'logs',
              { ...v, budgetItemId: v.budgetItemId || undefined },
              'Bitácora guardada; ya puedes adjuntar evidencia',
            );
          }}
        >
          {projectSelect}
          <div className="form-grid">
            <Field label="Fecha">
              <input name="date" type="date" defaultValue={today()} required />
            </Field>
            <Field label="Personal en obra">
              <input
                name="crew"
                type="number"
                min="0"
                max="10000"
                step="1"
                required
                defaultValue="0"
              />
            </Field>
          </div>
          <Field label="Frente de trabajo (opcional)">
            <input name="front" maxLength={200} placeholder="Ej. Edificio A · nivel 2" />
          </Field>
          <Field label="Concepto del presupuesto (opcional)">
            <select key={chosen} name="budgetItemId" defaultValue="">
              <option value="">Sin concepto asociado</option>
              {(data.projects.find((p) => p.id === chosen)?.budgetItems || []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} · {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Título del registro">
            <input
              name="title"
              placeholder="Ej. Colado de losa, edificio A"
              required
              maxLength={200}
            />
          </Field>
          <Field label="Actividades realizadas">
            <textarea
              name="activities"
              rows={4}
              required
              maxLength={10000}
              placeholder="Describe trabajos, avances y observaciones…"
            />
          </Field>
          <Field label="Incidencias o pendientes (opcional)">
            <textarea name="incident" rows={2} maxLength={5000} />
          </Field>
          <Field label="Condiciones del clima">
            <select name="weather">
              <option>Despejado</option>
              <option>Nublado</option>
              <option>Lluvia</option>
              <option>Sin registrar</option>
            </select>
          </Field>
          {errors}
          {actions('Guardar bitácora', !chosen)}
        </form>
      )}
      {type === 'apu' && (
        <>
          <div className="detail-heading">
            <div>
              <h3>{item.name}</h3>
              <p>
                {item.code} · Unidad: {item.unit}
              </p>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Componente</th>
                  <th className="numeric">Consumo</th>
                  <th className="numeric">Precio</th>
                  <th className="numeric">Costo</th>
                </tr>
              </thead>
              <tbody>
                {item.components.map((c: any, i: number) => (
                  <tr key={i}>
                    <td>{c.name}</td>
                    <td className="numeric">{qty(c.quantity)}</td>
                    <td className="numeric">{money(c.price)}</td>
                    <td className="numeric">{money(c.quantity * c.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="calculation">
            <span>
              Precio unitario directo <b>{money(item.unitPrice)}</b>
            </span>
            <span>
              Volumen{' '}
              <b>
                {qty(item.quantity)} {item.unit}
              </b>
            </span>
            <span>
              Importe <b>{money(Number(item.quantity) * Number(item.unitPrice))}</b>
            </span>
          </div>
        </>
      )}
      {type === 'confirm' && (
        <>
          <p className="confirm-message">{item.message}</p>
          {errors}
          <div className="dialog-actions">
            <button className="secondary" disabled={busy} onClick={close}>
              Volver
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={() => mutate(item.path, {}, 'Operación registrada')}
            >
              {busy ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}Confirmar
            </button>
          </div>
        </>
      )}
    </>
  );
}
