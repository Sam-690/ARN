'use client';
import { Check, Plus, Trash2 } from 'lucide-react';
import { FormEvent, useState } from 'react';
import type { Data } from '../../types';
import { day, Field, localDay, money, qty, Save, today } from './helpers';
export function RecordForm({
  data,
  projectId,
  busy,
  save,
  onDone,
}: {
  data: Data;
  projectId: string;
  busy: boolean;
  save: Save;
  onDone: () => void;
}) {
  const [pid, setPid] = useState(projectId === 'all' ? '' : projectId),
    [itemId, setItemId] = useState(''),
    [familyId, setFamilyId] = useState(''),
    [coverage, setCoverage] = useState('MATERIAL_ONLY'),
    [start, setStart] = useState(today()),
    [end, setEnd] = useState(today()),
    [allocations, setAllocations] = useState<{ movementId: string; quantity: number }[]>([]),
    [isTest, setIsTest] = useState(true);
  const project = data.projects.find((p) => p.id === pid),
    item = project?.budgetItems.find((b) => b.id === itemId),
    family = data.experience.families.find((f) => f.id === familyId),
    movements = data.experience.movements.filter(
      (m) =>
        m.projectId === pid &&
        Number(m.available) > 0 &&
        localDay(m.createdAt) >= start &&
        localDay(m.createdAt) <= end,
    );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.currentTarget));
    if (
      await save(
        'experience/records',
        {
          projectId: pid,
          budgetItemId: itemId,
          familyId,
          reference: v.reference,
          front: v.front,
          startDate: start,
          endDate: end,
          quantity: Number(v.quantity),
          isTest,
          coverage,
          laborCost: coverage === 'DIRECT_COMPLETE' ? Number(v.laborCost) : 0,
          equipmentCost: coverage === 'DIRECT_COMPLETE' ? Number(v.equipmentCost) : 0,
          otherCost: coverage === 'DIRECT_COMPLETE' ? Number(v.otherCost) : 0,
          laborHours: coverage === 'DIRECT_COMPLETE' && v.laborHours ? Number(v.laborHours) : null,
          costReference: v.costReference || '',
          note: v.note,
          allocations,
          confirmed: v.confirmed === 'on',
        },
        isTest
          ? 'Prueba guardada y excluida de promedios'
          : 'Ejecución guardada; pendiente de validar como muestra',
      )
    )
      onDone();
  }
  return (
    <form className="panel experience-form" onSubmit={submit}>
      <h2>Registrar ejecución y costos</h2>
      <p className="small-note">
        La obra debe tener una línea base aprobada. Registra solo la cantidad nueva ejecutada en
        este periodo, no el avance acumulado. Usa un frente distinto para trabajos físicamente
        separados.
      </p>
      <fieldset disabled={busy}>
        <div className="form-grid">
          <Field label="Obra del registro">
            <select
              required
              value={pid}
              onChange={(e) => {
                setPid(e.target.value);
                setItemId('');
                setAllocations([]);
              }}
            >
              <option value="">Selecciona una obra</option>
              {data.projects
                .filter(
                  (p) =>
                    p.status === 'ACTIVE' &&
                    p.budgetApproved &&
                    (projectId === 'all' || p.id === projectId),
                )
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} · {p.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Concepto ejecutado">
            <select
              required
              value={itemId}
              onChange={(e) => {
                setItemId(e.target.value);
                setFamilyId('');
              }}
            >
              <option value="">Selecciona el concepto</option>
              {project?.budgetItems.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} · {b.name} ({b.unit})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Grupo y versión comparable">
            <select required value={familyId} onChange={(e) => setFamilyId(e.target.value)}>
              <option value="">Selecciona un grupo</option>
              {data.experience.families
                .filter(
                  (f) =>
                    item &&
                    f.unit.normalize('NFKC').trim().toLowerCase() ===
                      item.unit.normalize('NFKC').trim().toLowerCase(),
                )
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.code} · {f.name} · {f.version}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Origen de los datos">
            <select
              value={isTest ? 'test' : 'real'}
              onChange={(e) => setIsTest(e.target.value === 'test')}
            >
              <option value="test">Prueba / demostración — excluir de biblioteca</option>
              <option value="real">Ejecución real — pendiente de validación</option>
            </select>
          </Field>
        </div>
        {family && (
          <div className="experience-notice">
            <strong>
              {family.name} · {family.version}
            </strong>
            <p>{family.method}</p>
            <p>Condiciones: {family.conditions}</p>
          </div>
        )}
        {item && (
          <p className="small-note">
            Línea base: {qty(item.quantity)} {item.unit} a {money(item.unitPrice)} / {item.unit}. Se
            conservará una copia de esta versión del concepto.
          </p>
        )}
        <div className="form-grid">
          <Field label="Referencia única del registro">
            <input name="reference" required maxLength={200} placeholder="Ej. REP-001" />
          </Field>
          <Field label="Frente / zona física">
            <input
              name="front"
              required
              maxLength={200}
              placeholder="Ej. Edificio A · planta baja"
            />
          </Field>
          <Field label="Inicio del periodo">
            <input
              type="date"
              required
              min={project ? day(project.startDate) : undefined}
              max={today()}
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
                setAllocations([]);
              }}
            />
          </Field>
          <Field label="Fin del periodo">
            <input
              type="date"
              required
              min={start}
              max={today()}
              value={end}
              onChange={(e) => {
                setEnd(e.target.value);
                setAllocations([]);
              }}
            />
          </Field>
          <Field label={`Cantidad ejecutada (${item?.unit || 'unidad del concepto'})`}>
            <input
              name="quantity"
              type="number"
              step=".0001"
              min=".0001"
              max="100000000"
              required
            />
          </Field>
          <Field label="Cobertura de costos">
            <select value={coverage} onChange={(e) => setCoverage(e.target.value)}>
              <option value="MATERIAL_ONLY">Solo materiales asignados</option>
              <option value="DIRECT_COMPLETE">Costo directo completo declarado</option>
            </select>
          </Field>
        </div>
        <h3>Asignar salidas existentes</h3>
        <p className="small-note">
          Estas salidas ya descontaron almacén. Asignarlas aquí no genera otra salida. Las
          asignaciones de prueba también reservan cantidad hasta anularse.
        </p>
        {allocations.map((a, i) => (
          <div className="experience-allocation" key={i}>
            <Field label={`Salida ${i + 1}`}>
              <select
                required
                value={a.movementId}
                onChange={(e) =>
                  setAllocations(
                    allocations.map((x, n) =>
                      n === i ? { movementId: e.target.value, quantity: 0 } : x,
                    ),
                  )
                }
              >
                <option value="">Selecciona una salida del periodo</option>
                {movements
                  .filter(
                    (m) => m.id === a.movementId || !allocations.some((x) => x.movementId === m.id),
                  )
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {localDay(m.createdAt)} · {m.material.name} · libre {qty(m.available)}{' '}
                      {m.material.unit} · {m.reference}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label={`Cantidad asignada ${i + 1}`}>
              <input
                type="number"
                required
                min=".0001"
                step=".0001"
                max={movements.find((m) => m.id === a.movementId)?.available || 0}
                value={a.quantity || ''}
                onChange={(e) =>
                  setAllocations(
                    allocations.map((x, n) =>
                      n === i ? { ...x, quantity: Number(e.target.value) } : x,
                    ),
                  )
                }
              />
            </Field>
            <button
              className="icon-button"
              type="button"
              aria-label={`Quitar asignación ${i + 1}`}
              onClick={() => setAllocations(allocations.filter((_, n) => n !== i))}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <button
          className="secondary"
          type="button"
          disabled={!movements.length || allocations.length >= 100}
          onClick={() => setAllocations([...allocations, { movementId: '', quantity: 0 }])}
        >
          <Plus size={15} />
          Asignar salida
        </button>
        {!movements.length && (
          <p className="experience-notice">
            No hay salidas disponibles en esta obra y periodo. Registra el consumo en Almacén o
            selecciona el periodo correcto.
          </p>
        )}
        {coverage === 'DIRECT_COMPLETE' && (
          <>
            <h3>Otros costos directos del periodo</h3>
            <p className="small-note">
              Importes reales netos en MXN; no se crean pagos ni nómina. Registra cero solo si ese
              rubro no tuvo costo.
            </p>
            <div className="form-grid">
              {[
                ['laborCost', 'Mano de obra (MXN)'],
                ['equipmentCost', 'Equipo (MXN)'],
                ['otherCost', 'Otros directos (MXN)'],
              ].map(([name, label]) => (
                <Field key={name} label={label}>
                  <input
                    type="number"
                    name={name}
                    min="0"
                    max="100000000"
                    step=".01"
                    required
                    defaultValue="0"
                  />
                </Field>
              ))}
              <Field label="Horas-persona totales (opcional)">
                <input
                  name="laborHours"
                  type="number"
                  step=".0001"
                  min=".0001"
                  max="100000000"
                  placeholder="Suma de horas de toda la cuadrilla"
                />
              </Field>
            </div>
            <Field label="Fuente de costos y horas">
              <textarea
                name="costReference"
                maxLength={2000}
                rows={2}
                placeholder="Referencias de nómina, renta, reporte de horas u otros soportes"
              />
            </Field>
          </>
        )}
        <Field label="Condiciones observadas y notas">
          <textarea
            name="note"
            required
            maxLength={2000}
            rows={3}
            placeholder="Describe el trabajo, condiciones y cómo verificaste cantidades y costos"
          />
        </Field>
        <label className="document-confirm">
          <input name="confirmed" type="checkbox" required />
          Verifiqué la cantidad nueva, el frente, las fuentes y la cobertura de costos.{' '}
          {coverage === 'DIRECT_COMPLETE'
            ? 'Incluí todos los costos directos de esta ejecución.'
            : ''}
        </label>
        <button className="primary">
          <Check size={16} />
          Guardar ejecución
        </button>
      </fieldset>
    </form>
  );
}
