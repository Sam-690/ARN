'use client';
import { ArrowUpRight, CheckCheck, Wallet } from 'lucide-react';
import { Dialog } from '../../shared/navigation';
import { day, Empty, money } from '../../shared/presentation';
import type { Order } from '../../types';
export function PaymentsView({
  orders,
  paid,
  due,
  can,
  openDialog,
}: {
  orders: Order[];
  paid: number;
  due: number;
  can: (permission: string) => boolean;
  openDialog: (d: Dialog) => void;
}) {
  return (
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
          Registro interno de pagos contra material recibido, sin ejecución bancaria. La gestión de
          facturas, impuestos y anticipos está pendiente.
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
  );
}
