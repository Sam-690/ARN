'use client';
import { ArrowUpRight } from 'lucide-react';
import { Dialog } from '../../shared/navigation';
import { Badge, day, Empty, labels, money, Toolbar } from '../../shared/presentation';
import type { Order } from '../../types';
export function OrdersView({
  search,
  setSearch,
  filter,
  setFilter,
  orders,
  matches,
  openDialog,
}: {
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  filter: string;
  setFilter: React.Dispatch<React.SetStateAction<string>>;
  orders: Order[];
  matches: (...s: string[]) => boolean;
  openDialog: (d: Dialog) => void;
}) {
  return (
    <>
      <Toolbar search={search} onSearch={setSearch} placeholder="Buscar proveedor, orden u obra…">
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
  );
}
