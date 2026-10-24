'use client';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { Dialog } from '../../shared/navigation';
import { Empty, eventDay, money, qty, Toolbar } from '../../shared/presentation';
import type { Data, Stock } from '../../types';
export function InventoryView({
  stocks,
  search,
  setSearch,
  matches,
  can,
  openDialog,
  data,
  projectId,
}: {
  stocks: Stock[];
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  matches: (...s: string[]) => boolean;
  can: (permission: string) => boolean;
  openDialog: (d: Dialog) => void;
  data: Data;
  projectId: string;
}) {
  return (
    <>
      <div className="mini-stats">
        <div>
          <span>Material en almacén</span>
          <strong>{stocks.filter((s) => Number(s.quantity) > 0).length} existencias</strong>
        </div>
        <div>
          <span>Valor del inventario</span>
          <strong>
            {money(stocks.reduce((n, s) => n + Number(s.quantity) * Number(s.averageCost), 0))}
          </strong>
        </div>
        <div>
          <span>Valuación</span>
          <strong>Promedio ponderado</strong>
        </div>
      </div>
      <Toolbar search={search} onSearch={setSearch} placeholder="Buscar material u obra…" />
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
                          !can('stock') || Number(s.quantity) <= 0 || s.project.status === 'CLOSED'
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
  );
}
