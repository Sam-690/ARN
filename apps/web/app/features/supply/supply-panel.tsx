'use client';
import { useViewPreference } from '../../shared/use-view-preference';
import { ArrowRight, CalendarClock, PackageCheck, Plus, Search, Truck } from 'lucide-react';
import { useCan } from '../../access';
import { date, money, Props, qty, statuses, today } from './helpers';
export function SupplyPanel({ data, projectId, open }: Props) {
  const can = useCan();
  const [search, setSearch] = useViewPreference<string>(
      data.user.id,
      'supply',
      projectId,
      'search',
      '',
    ),
    [showHistory, setShowHistory] = useViewPreference<boolean>(
      data.user.id,
      'supply',
      projectId,
      'showHistory',
      false,
    );
  const match = (p: string) => projectId === 'all' || p === projectId;
  const needs = data.needs.filter((n) => match(n.projectId));
  const filtered = needs.filter(
    (n) =>
      (showHistory || n.status === 'OPEN') &&
      `${n.material.name} ${n.project.name} ${n.purpose}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const coverage = new Map(data.coverage.map((c) => [c.needId, c]));
  const shortages = needs.filter((n) => Number(coverage.get(n.id)?.shortage) > 0);
  const transfers = data.transfers.filter((t) => match(t.fromProjectId) || match(t.toProjectId));
  const surplus = data.stocks.filter(
    (s) => s.project.status === 'ACTIVE' && Number(s.released) > 0,
  );
  const lateOrders = data.orders.filter(
    (o) =>
      match(o.projectId) &&
      ['APPROVED', 'PARTIAL'].includes(o.status) &&
      o.expectedDate.slice(0, 10) < today(),
  );
  return (
    <>
      <div className="mini-stats">
        <div>
          <span>Necesidades abiertas</span>
          <strong>{needs.filter((n) => n.status === 'OPEN').length}</strong>
        </div>
        <div>
          <span>Necesidades con faltante</span>
          <strong>{shortages.length}</strong>
        </div>
        <div>
          <span>Traspasos en tránsito</span>
          <strong>{transfers.filter((t) => t.status === 'IN_TRANSIT').length}</strong>
        </div>
      </div>
      <div className="section-note">
        <CalendarClock size={21} />
        <p>
          La cobertura distribuye el inventario utilizable y las compras aprobadas por fecha de
          necesidad. Los sobrantes liberados y el material en tránsito se muestran por separado. Las
          entregas previstas aún deben confirmarse al recibir.
        </p>
      </div>
      {lateOrders.length > 0 && (
        <div className="incident supply-warning">
          {lateOrders.length} compra(s) tienen entregas vencidas. No se cuentan como cobertura
          futura hasta su recepción.
        </div>
      )}
      <div className="toolbar">
        <label className="search">
          <Search size={17} />
          <input
            aria-label="Buscar necesidad"
            placeholder="Buscar material, obra o actividad…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label className="history-toggle">
          <input
            type="checkbox"
            checked={showHistory}
            onChange={(e) => setShowHistory(e.target.checked)}
          />
          Incluir atendidas y canceladas
        </label>
      </div>
      <div className="supply-needs">
        {filtered.map((n) => {
          const c = coverage.get(n.id);
          const stock = data.stocks.find(
            (s) => s.projectId === n.projectId && s.materialId === n.materialId,
          );
          const available = stock ? Number(stock.quantity) - Number(stock.released) : 0;
          return (
            <article className="panel supply-card" key={n.id}>
              <div className="supply-card-title">
                <div>
                  <span className="eyebrow">{n.project.name}</span>
                  <h2>{n.material.name}</h2>
                  <p>{n.purpose}</p>
                </div>
                <span
                  className={
                    'badge ' +
                    (c
                      ? c.urgency === 'COVERED'
                        ? 'approved'
                        : 'partial'
                      : n.status === 'FULFILLED'
                        ? 'received'
                        : 'cancelled')
                  }
                >
                  {c ? statuses[c.urgency] : n.status === 'FULFILLED' ? 'Atendida' : 'Cancelada'}
                </span>
              </div>
              <div className="supply-facts">
                <div>
                  <span>Necesario el</span>
                  <strong>{date(n.neededOn)}</strong>
                </div>
                <div>
                  <span>Solicitado / consumido</span>
                  <strong>
                    {qty(n.quantity)} / {qty(n.consumed)} {n.material.unit}
                  </strong>
                </div>
                {c && (
                  <>
                    <div>
                      <span>Cobertura / faltante</span>
                      <strong>
                        {qty(c.covered)} / {qty(c.shortage)} {n.material.unit}
                      </strong>
                    </div>
                    <div>
                      <span>Gestionar a más tardar</span>
                      <strong>{date(c.orderBy)}</strong>
                      <small>Plazo de suministro: {n.leadDays} días</small>
                    </div>
                  </>
                )}
              </div>
              {c && Number(c.shortage) > 0 && (
                <div className="supply-options">
                  <strong>Antes de comprar</strong>
                  {c.alternatives.length ? (
                    c.alternatives.map((a) => {
                      const s = data.stocks.find(
                        (x) => x.projectId === a.projectId && x.materialId === n.materialId,
                      )!;
                      return (
                        <div className="supply-option" key={a.projectId}>
                          <span>
                            {a.projectName} · {qty(a.available)} {n.material.unit} liberados
                          </span>
                          <button
                            className="text-button"
                            disabled={!can('stock')}
                            onClick={() =>
                              open({
                                type: 'transfer',
                                item: {
                                  ...s,
                                  toProjectId: n.projectId,
                                  suggestedQuantity: Math.min(
                                    Number(c.shortage),
                                    Number(a.available),
                                  ),
                                },
                              })
                            }
                          >
                            Preparar traspaso <ArrowRight size={14} />
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <p>No hay sobrantes declarados en otras obras.</p>
                  )}
                  <small>
                    La disponibilidad se valida al despachar. Confirma con ambas obras la fecha de
                    traslado y el flete.
                  </small>
                </div>
              )}
              {n.status === 'OPEN' && (
                <div className="supply-actions">
                  {c && Number(c.shortage) > 0 && (
                    <button
                      className="secondary"
                      disabled={!can('orders')}
                      onClick={() =>
                        open({
                          type: 'order',
                          item: {
                            projectId: n.projectId,
                            materialId: n.materialId,
                            quantity: Number(c.shortage),
                            expectedDate: n.neededOn.slice(0, 10),
                          },
                        })
                      }
                    >
                      <Plus size={14} />
                      Preparar compra
                    </button>
                  )}
                  <button
                    className="text-button"
                    disabled={available <= 0}
                    onClick={() => open({ type: 'consume', item: { ...stock, needId: n.id } })}
                  >
                    Registrar consumo
                  </button>
                  <button
                    className="subtle"
                    disabled={!can('supply')}
                    onClick={() => open({ type: 'cancelNeed', item: n })}
                  >
                    Cancelar necesidad
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
      {!filtered.length && (
        <div className="empty">
          <CalendarClock size={28} />
          <h3>{showHistory ? 'Sin necesidades para mostrar' : 'Sin necesidades abiertas'}</h3>
          <p>Planifica cantidades y fechas para identificar faltantes antes de comprar.</p>
        </div>
      )}
      <section className="panel budget-panel">
        <div className="panel-head">
          <div>
            <h2>Sobrantes de tus obras autorizadas</h2>
            <p>Cantidades liberadas expresamente desde Almacén</p>
          </div>
          <Truck size={20} />
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Material / origen</th>
                <th className="numeric">Liberado</th>
                <th className="numeric">Costo unitario</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {surplus.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.material.name}</strong>
                    <small>{s.project.name}</small>
                  </td>
                  <td className="numeric">
                    {qty(s.released)} {s.material.unit}
                  </td>
                  <td className="numeric">{money(s.averageCost)}</td>
                  <td>
                    <button
                      className="text-button"
                      disabled={!can('stock')}
                      onClick={() =>
                        open({
                          type: 'transfer',
                          item: {
                            ...s,
                            toProjectId:
                              projectId !== 'all' && projectId !== s.projectId
                                ? projectId
                                : undefined,
                          },
                        })
                      }
                    >
                      Preparar traspaso
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!surplus.length && (
          <div className="empty">
            <p>Aún no hay sobrantes liberados. Puedes declararlos en Almacén.</p>
          </div>
        )}
      </section>
      <section className="panel budget-panel">
        <div className="panel-head">
          <div>
            <h2>Traspasos entre obras</h2>
            <p>Despacho, material en tránsito y recepción confirmada</p>
          </div>
          <PackageCheck size={20} />
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Traspaso / material</th>
                <th>Origen → destino</th>
                <th className="numeric">Cantidad / valor</th>
                <th>Estado / evidencia</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {transfers.map((t) => (
                <tr key={t.id}>
                  <td>
                    <strong>
                      TR-{String(t.number).padStart(4, '0')} · {t.material.name}
                    </strong>
                    <small>
                      {date(t.createdAt)} · {t.dispatchedBy}
                    </small>
                    <small>{t.reference}</small>
                  </td>
                  <td>
                    {t.fromProject.name}
                    <br />→ {t.toProject.name}
                  </td>
                  <td className="numeric">
                    {qty(t.quantity)} {t.material.unit}
                    <small>{money(Number(t.quantity) * Number(t.unitCost))}</small>
                  </td>
                  <td>
                    <span
                      className={'badge ' + (t.status === 'IN_TRANSIT' ? 'partial' : 'received')}
                    >
                      {t.status === 'IN_TRANSIT' ? 'En tránsito' : 'Recibido'}
                    </span>
                    {t.receivedAt && (
                      <small>
                        {date(t.receivedAt)} · {t.receivedBy}
                        <br />
                        {t.receiptReference}
                      </small>
                    )}
                  </td>
                  <td>
                    {t.status === 'IN_TRANSIT' && (
                      <button
                        className="text-button"
                        disabled={!can('stock')}
                        onClick={() => open({ type: 'receiveTransfer', item: t })}
                      >
                        Confirmar recepción
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!transfers.length && (
          <div className="empty">
            <p>Los traspasos despachados aparecerán aquí.</p>
          </div>
        )}
      </section>
    </>
  );
}
