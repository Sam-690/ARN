'use client';
import { Check, Package } from 'lucide-react';
import { Dialog } from '../../shared/navigation';
import { Badge, day, money, qty } from '../../shared/presentation';
import type { Order } from '../../types';
export function OrderDetailForm({
  item,
  errors,
  busy,
  can,
  open,
}: {
  item: any;
  errors: React.JSX.Element | null;
  busy: boolean;
  can: (permission: string) => boolean;
  open: (d: Dialog) => void;
}) {
  return (
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
  );
}
