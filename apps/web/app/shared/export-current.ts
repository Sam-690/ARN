'use client';
import { changeLabels } from '../features/changes';
import type { Data, Order, Project, Stock } from '../types';
import { Dialog, Page } from './navigation';
import { labels } from './presentation';
export function download(name: string, headers: string[], rows: (string | number)[][]) {
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
export function exportCurrent({
  data,
  page,
  openDialog,
  projectId,
  projects,
  stocks,
  orders,
  allProjects,
  setToast,
}: {
  data: Data;
  page: Page;
  openDialog: (d: Dialog) => void;
  projectId: string;
  projects: Project[];
  stocks: Stock[];
  orders: Order[];
  allProjects: Project[];
  setToast: React.Dispatch<React.SetStateAction<string>>;
}) {
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
