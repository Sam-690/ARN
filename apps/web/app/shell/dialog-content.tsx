'use client';
import { Check, LoaderCircle } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { useCan } from '../access';
import { Dialog } from '../shared/navigation';
import { Field } from '../shared/presentation';
import type { Data } from '../types';
import { ApuForm } from '../features/budget/apu-form';
import { BudgetForm } from '../features/budget/budget-form';
import { ConfirmForm } from './confirm-form';
import { ConsumeForm } from '../features/inventory/consume-form';
import { LogForm } from '../features/logs/log-form';
import { MaterialForm } from '../features/materials/material-form';
import { OrderDetailForm } from '../features/orders/order-detail-form';
import { OrderForm } from '../features/orders/order-form';
import { PayForm } from '../features/payments/pay-form';
import { ProjectForm } from '../features/projects/project-form';
import { ReceiveForm } from '../features/orders/receive-form';
export function DialogContent({
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
        <ProjectForm
          values={values}
          mutate={mutate}
          data={data}
          errors={errors}
          actions={actions}
        />
      )}
      {type === 'material' && (
        <MaterialForm mutate={mutate} values={values} errors={errors} actions={actions} />
      )}
      {type === 'budget' && (
        <BudgetForm
          mutate={mutate}
          values={values}
          projectSelect={projectSelect}
          active={active}
          volume={volume}
          setVolume={setVolume}
          components={components}
          data={data}
          setComponents={setComponents}
          errors={errors}
          actions={actions}
          chosen={chosen}
        />
      )}
      {type === 'order' && (
        <OrderForm
          mutate={mutate}
          values={values}
          orderLines={orderLines}
          projectSelect={projectSelect}
          item={item}
          data={data}
          setOrderLines={setOrderLines}
          errors={errors}
          actions={actions}
          chosen={chosen}
        />
      )}
      {type === 'orderDetail' && (
        <OrderDetailForm item={item} errors={errors} busy={busy} can={can} open={open} />
      )}
      {type === 'receive' && (
        <ReceiveForm
          item={item}
          receiveLine={receiveLine}
          mutate={mutate}
          values={values}
          setReceiveLine={setReceiveLine}
          errors={errors}
          actions={actions}
        />
      )}
      {type === 'consume' && (
        <ConsumeForm
          values={values}
          mutate={mutate}
          item={item}
          data={data}
          errors={errors}
          actions={actions}
        />
      )}
      {type === 'pay' && (
        <PayForm mutate={mutate} item={item} values={values} errors={errors} actions={actions} />
      )}
      {type === 'log' && (
        <LogForm
          values={values}
          mutate={mutate}
          projectSelect={projectSelect}
          chosen={chosen}
          data={data}
          errors={errors}
          actions={actions}
        />
      )}
      {type === 'apu' && <ApuForm item={item} />}
      {type === 'confirm' && (
        <ConfirmForm item={item} errors={errors} busy={busy} close={close} mutate={mutate} />
      )}
    </>
  );
}
