'use client';
import { Empty, labels, money, Toolbar } from '../../shared/presentation';
import type { Data } from '../../types';
export function MaterialsView({
  search,
  setSearch,
  filter,
  setFilter,
  data,
  matches,
}: {
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  filter: string;
  setFilter: React.Dispatch<React.SetStateAction<string>>;
  data: Data;
  matches: (...s: string[]) => boolean;
}) {
  return (
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
                .filter((m) => (filter === 'all' || m.type === filter) && matches(m.name, m.code))
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
  );
}
