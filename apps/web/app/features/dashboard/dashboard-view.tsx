'use client';
import {
  Activity,
  ArrowRight,
  Building2,
  Calculator,
  CheckCheck,
  ChevronRight,
  NotebookPen,
  ShoppingCart,
  Wallet,
} from 'lucide-react';
import { BudgetAdjustment } from '../changes';
import { Dialog, Page } from '../../shared/navigation';
import {
  Attention,
  Badge,
  Empty,
  money,
  ProjectRow,
  Resource,
  Stat,
} from '../../shared/presentation';
import type { Log, Order, Project, Stock } from '../../types';
export function DashboardView({
  projects,
  totalBudget,
  committed,
  due,
  go,
  orders,
  openProject,
  logs,
  openDialog,
  paid,
  stocks,
}: {
  projects: Project[];
  totalBudget: number;
  committed: number;
  due: number;
  go: (p: Page) => void;
  orders: Order[];
  openProject: (id: string) => void;
  logs: Log[];
  openDialog: (d: Dialog) => void;
  paid: number;
  stocks: Stock[];
}) {
  return (
    <>
      <div className="stats">
        <Stat
          label="Obras en ejecución"
          value={String(projects.filter((p) => p.status === 'ACTIVE').length).padStart(2, '0')}
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
              <p>La línea base se conserva; los ajustes provienen de solicitudes autorizadas.</p>
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
            <Resource label="Pagado a proveedores" value={paid} max={totalBudget} color="blue" />
            <Resource
              label="Inventario disponible"
              value={stocks.reduce((n, s) => n + Number(s.quantity) * Number(s.averageCost), 0)}
              max={totalBudget}
              color="orange"
            />
            <p className="small-note">
              Las compras, el inventario y los pagos representan etapas distintas. Estos importes no
              se suman.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
