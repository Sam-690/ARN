'use client';
import { money, qty } from '../../shared/presentation';
export function ApuForm({ item }: { item: any }) {
  return (
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
  );
}
