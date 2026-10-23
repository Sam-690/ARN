'use client';
import { EntryModal } from './entry-modal';
import { useCan } from './access';
import { useEffect, useRef, useState, FormEvent } from 'react';
import { BookOpen, Plus, Check, Trash2, RefreshCw } from 'lucide-react';
import type { Data, ExperienceRecord, ExperienceGroup } from './types';
type Save = (path: string, body: unknown, message: string) => Promise<boolean>;
const money = (n: string | number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(n));
const qty = (n: string | number) =>
  new Intl.NumberFormat('es-MX', { maximumFractionDigits: 4 }).format(Number(n));
const day = (s: string) => s.slice(0, 10);
const localDay = (s: string) =>
  new Date(s).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
const today = () => localDay(new Date().toISOString());
const statusLabels: Record<string, string> = {
  RECORDED: 'Por validar',
  VALIDATED: 'Muestra validada',
  VOID: 'Anulado',
};
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function FamilyForm({ save, busy, onDone }: { save: Save; busy: boolean; onDone: () => void }) {
  return (
    <form
      className="panel experience-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const v = Object.fromEntries(new FormData(e.currentTarget));
        if (await save('experience/families', v, 'Grupo de comparación creado')) onDone();
      }}
    >
      <h2>Nuevo grupo comparable</h2>
      <p className="small-note">
        Define qué trabajos se pueden comparar. Esta versión quedará fija; si cambia el método o las
        condiciones, crea otra versión.
      </p>
      <fieldset disabled={busy}>
        <div className="form-grid">
          {[
            ['code', 'Clave', '24'],
            ['version', 'Versión del método', '40'],
            ['name', 'Nombre del grupo', '200'],
            ['unit', 'Unidad ejecutada', '16'],
          ].map(([name, label, max]) => (
            <Field key={name} label={label}>
              <input name={name} required maxLength={Number(max)} />
            </Field>
          ))}
        </div>
        <Field label="Método y especificación">
          <textarea
            name="method"
            required
            maxLength={2000}
            rows={3}
            placeholder="Ej. Muro de block de 15 cm, mortero y cuadrilla definidos"
          />
        </Field>
        <Field label="Condiciones comparables">
          <textarea
            name="conditions"
            required
            maxLength={2000}
            rows={3}
            placeholder="Altura, acceso, equipo, clima y restricciones del trabajo"
          />
        </Field>
        <button className="primary">
          <Plus size={16} />
          Guardar grupo
        </button>
      </fieldset>
    </form>
  );
}
function RecordForm({
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
function RecordDetail({
  record: r,
  busy,
  save,
}: {
  record: ExperienceRecord;
  busy: boolean;
  save: Save;
}) {
  const can = useCan();
  const [action, setAction] = useState('');
  return (
    <section className="panel experience-form">
      <span className="eyebrow">
        EXP-{r.number} · {r.isTest ? 'PRUEBA EXCLUIDA' : statusLabels[r.status]}
      </span>
      <h2>{r.budgetSnapshot.name}</h2>
      <p>
        {r.project.name} · {r.front} · {day(r.startDate)} a {day(r.endDate)}
      </p>
      <div className="mini-stats">
        <div>
          <span>Ejecutado en el periodo</span>
          <strong>
            {qty(r.quantity)} {r.family.unit}
          </strong>
        </div>
        <div>
          <span>
            {r.coverage === 'DIRECT_COMPLETE'
              ? 'Costo directo declarado'
              : 'Costo material asignado'}
          </span>
          <strong>{money(r.metrics.recordedCost)}</strong>
        </div>
        <div>
          <span>Costo registrado / {r.family.unit}</span>
          <strong>{money(r.metrics.unitCost)}</strong>
        </div>
      </div>
      {r.coverage === 'DIRECT_COMPLETE' ? (
        <div className="experience-notice">
          <p>
            Línea base para esta cantidad: {money(r.metrics.plannedCost)} · Variación:{' '}
            <strong>{money(r.metrics.variance || 0)}</strong>
          </p>
          <p>
            Mano de obra: {money(r.laborCost)} · Equipo: {money(r.equipmentCost)} · Otros:{' '}
            {money(r.otherCost)} · Material: {money(r.metrics.materialCost)}
          </p>
        </div>
      ) : (
        <p className="experience-notice">
          Cobertura parcial: solo materiales. No se compara este importe con el costo directo
          completo del presupuesto.
        </p>
      )}
      {r.laborHours && (
        <p>
          Horas-persona: {qty(r.laborHours)} · Productividad: {qty(r.metrics.productivity || 0)}{' '}
          {r.family.unit}/hora-persona
        </p>
      )}
      <h3>Fuentes y condiciones</h3>
      <p className="preserve">{r.note}</p>
      {r.costReference && <p className="preserve">Soporte: {r.costReference}</p>}
      <p className="small-note">
        {r.reference} · Registró {r.author} · {localDay(r.createdAt)}
      </p>
      <div className="experience-sources">
        {r.allocations.map((a) => (
          <article key={a.id}>
            <strong>{a.movement.material.name}</strong>
            <p>
              {qty(a.quantity)} {a.movement.material.unit} a {money(a.unitCost)} /{' '}
              {a.movement.material.unit}
            </p>
            <small>
              Salida {localDay(a.movement.createdAt)} · {a.movement.reference} · {a.movement.id}
            </small>
          </article>
        ))}
      </div>
      <details className="change-history">
        <summary>Línea base conservada · {r.budgetHash.slice(0, 12)}</summary>
        <p>
          {r.budgetSnapshot.code} · {r.budgetSnapshot.name} · {money(r.plannedUnitPrice)}/
          {r.budgetSnapshot.unit}
        </p>
        {r.budgetSnapshot.components.map((c, i) => (
          <p key={i}>
            {c.name}: {qty(c.quantity)} × {money(c.price)}
          </p>
        ))}
      </details>
      <h3>Grupo comparable</h3>
      <p>
        {r.family.code} · {r.family.name} · versión {r.family.version}
      </p>
      <p className="preserve">{r.family.method}</p>
      <p className="preserve">{r.family.conditions}</p>
      {r.isTest && (
        <p className="experience-notice">
          Registro de prueba: nunca entra en promedios ni rendimientos de la biblioteca.
        </p>
      )}
      {can('validateExperience') && r.project.status === 'ACTIVE' && r.status !== 'VOID' && (
        <>
          <div className="log-actions">
            {!r.isTest && (
              <button
                disabled={busy}
                className="secondary"
                onClick={() => setAction(r.status === 'VALIDATED' ? 'WITHDRAW' : 'VALIDATE')}
              >
                {r.status === 'VALIDATED'
                  ? 'Retirar de la biblioteca'
                  : 'Validar como muestra real'}
              </button>
            )}
            <button disabled={busy} className="secondary" onClick={() => setAction('VOID')}>
              Anular registro
            </button>
          </div>
          {action && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const v = new FormData(e.currentTarget);
                if (
                  await save(
                    `experience/records/${r.id}/actions`,
                    { action, expectedRevision: r.revision, note: v.get('note'), confirmed: true },
                    'Estado de experiencia actualizado',
                  )
                )
                  setAction('');
              }}
            >
              <fieldset disabled={busy}>
                <p className="experience-notice">
                  {action === 'VALIDATE'
                    ? 'Confirma que las fuentes son reales, la ejecución está completa para este periodo y el grupo describe el mismo método y condiciones. Se incluirá esta muestra en los promedios.'
                    : action === 'VOID'
                      ? 'Se excluirá el registro y se liberarán sus asignaciones. El historial se conserva; no se devuelve material al almacén. Para corregir, registra una nueva ejecución con otra referencia.'
                      : 'La muestra dejará de participar en promedios y conservará sus asignaciones.'}
                </p>
                <Field label="Motivo de validación o cambio">
                  <textarea name="note" required maxLength={2000} rows={2} />
                </Field>
                <label className="document-confirm">
                  <input type="checkbox" required />
                  Confirmo esta decisión y su motivo.
                </label>
                <button className="primary">
                  Confirmar{' '}
                  {action === 'VALIDATE'
                    ? 'validación'
                    : action === 'VOID'
                      ? 'anulación'
                      : 'retiro'}
                </button>
              </fieldset>
            </form>
          )}
        </>
      )}
      <details className="change-history">
        <summary>Historial ({r.events.length})</summary>
        {r.events.map((e) => (
          <article key={e.id}>
            <strong>
              {{
                CREATE: 'Registro creado',
                VALIDATE: 'Muestra validada',
                WITHDRAW: 'Retirada de promedios',
                VOID: 'Anulado',
              }[e.action] || e.action}
            </strong>
            <small>
              {e.actor} · {new Date(e.createdAt).toLocaleString('es-MX')}
            </small>
            <p>{e.note}</p>
          </article>
        ))}
      </details>
    </section>
  );
}
function GroupCard({
  group: g,
  data,
  onSelect,
}: {
  group: ExperienceGroup;
  data: Data;
  onSelect: (id: string) => void;
}) {
  const f = data.experience.families.find((f) => f.id === g.familyId)!;
  return (
    <article className="panel experience-form">
      <span className="eyebrow">
        {f.code} · VERSIÓN {f.version}
      </span>
      <h3>{f.name}</h3>
      <p className="small-note">
        {f.method} · {f.conditions}
      </p>
      <div className="mini-stats">
        <div>
          <span>
            {g.coverage === 'DIRECT_COMPLETE' ? 'Directo completo' : 'Solo materiales'} / {f.unit}
          </span>
          <strong>{money(g.unitCost)}</strong>
        </div>
        <div>
          <span>Muestras / obras</span>
          <strong>
            {g.sampleCount} / {g.projectCount}
          </strong>
        </div>
        <div>
          <span>Ejecutado observado</span>
          <strong>
            {qty(g.quantity)} {f.unit}
          </strong>
        </div>
      </div>
      <p>
        Rango por registro: {money(g.minUnitCost)}–{money(g.maxUnitCost)} / {f.unit}
      </p>
      <p className="small-note">
        Promedio ponderado por cantidad ejecutada. Costos históricos nominales en MXN; no se ajustan
        por fecha, inflación o ubicación.
      </p>
      {g.sampleCount < 3 && (
        <p className="experience-notice">
          Muestra pequeña: {g.sampleCount} registro(s). Es una referencia histórica, no un
          rendimiento garantizado.
        </p>
      )}
      {g.productivity && (
        <p>
          Productividad: {qty(g.productivity)} {f.unit}/hora-persona · {g.hoursSampleCount}{' '}
          registros con horas ({qty(g.laborHours)} h).
        </p>
      )}
      <details className="change-history">
        <summary>Consumos y fuentes verificables</summary>
        {g.materials.map((m) => (
          <article key={m.materialId}>
            <strong>
              {m.name}: {qty(m.consumptionPerUnit)} {m.unit}/{f.unit}
            </strong>
            <p>
              {qty(m.quantity)} {m.unit} asignados en {m.sampleCount} registros; divisor: toda la
              ejecución del grupo ({qty(g.quantity)} {f.unit}).
            </p>
          </article>
        ))}
        {g.sourceIds.map((id) => {
          const r = data.experience.records.find((r) => r.id === id)!;
          return (
            <button key={id} className="text-button" onClick={() => onSelect(id)}>
              EXP-{r.number} · {r.project.name} · {day(r.startDate)} / {day(r.endDate)} ·{' '}
              {qty(r.quantity)} {f.unit}
            </button>
          );
        })}
      </details>
    </article>
  );
}
export function ExperiencePanel({
  data,
  projectId,
  busy,
  error,
  save,
  refresh,
}: {
  data: Data;
  projectId: string;
  busy: boolean;
  error: string;
  save: Save;
  refresh: () => Promise<void>;
}) {
  const can = useCan();
  const [mode, setMode] = useState(''),
    [selected, setSelected] = useState(''),
    [filter, setFilter] = useState('all'),
    [search, setSearch] = useState('');
  const errorRef = useRef<HTMLDivElement>(null);
  const records = data.experience.records.filter(
      (r) => projectId === 'all' || r.projectId === projectId,
    ),
    groups =
      projectId === 'all' ? data.experience.groups : data.experience.byProject[projectId] || [],
    record = records.find((r) => r.id === selected),
    visible = records.filter(
      (r) =>
        (filter === 'all' || (filter === 'test' ? r.isTest : !r.isTest && r.status === filter)) &&
        [r.reference, r.front, r.budgetSnapshot.name, 'EXP-' + r.number]
          .join(' ')
          .toLowerCase()
          .includes(search.toLowerCase()),
    );
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [error]);
  return (
    <div className="experience-module">
      <div className="plans-actions">
        <p className="small-note">
          Registrar ejecución → cotejar fuentes → validar muestra → comparar.
        </p>
        <div className="log-actions">
          <button
            disabled={busy || !can('families')}
            className="secondary"
            onClick={() => setMode(mode === 'family' ? '' : 'family')}
          >
            Nuevo grupo comparable
          </button>
          <button
            className="primary"
            disabled={
              busy ||
              !can('experience') ||
              !data.projects.some(
                (p) =>
                  p.status === 'ACTIVE' &&
                  p.budgetApproved &&
                  (projectId === 'all' || p.id === projectId),
              )
            }
            onClick={() => setMode(mode === 'record' ? '' : 'record')}
          >
            <Plus size={16} />
            Registrar ejecución
          </button>
        </div>
      </div>
      {error && (
        <div ref={errorRef} className="error" role="alert">
          {error}
          <button className="text-button" onClick={refresh} disabled={busy}>
            Actualizar datos
          </button>
        </div>
      )}
      <div className="mini-stats">
        <div>
          <span>Muestras reales validadas</span>
          <strong>{records.filter((r) => !r.isTest && r.status === 'VALIDATED').length}</strong>
        </div>
        <div>
          <span>Registros reales por validar</span>
          <strong>{records.filter((r) => !r.isTest && r.status === 'RECORDED').length}</strong>
        </div>
        <div>
          <span>Pruebas excluidas</span>
          <strong>{records.filter((r) => r.isTest && r.status !== 'VOID').length}</strong>
        </div>
      </div>
      {mode && (
        <EntryModal
          title={mode === 'family' ? 'Nuevo grupo comparable' : 'Registrar ejecución'}
          busy={busy}
          error={error}
          onClose={() => setMode('')}
        >
          {mode === 'family' ? (
            <FamilyForm save={save} busy={busy} onDone={() => setMode('')} />
          ) : (
            <RecordForm
              data={data}
              projectId={projectId}
              busy={busy}
              save={save}
              onDone={() => setMode('')}
            />
          )}
        </EntryModal>
      )}
      <div className="panel experience-intro">
        <BookOpen size={24} />
        <div>
          <h2>Referencias de trabajos comparables</h2>
          <p>
            Solo registros reales validados, separados por grupo, versión y cobertura de costos.{' '}
            {projectId === 'all' ? 'Todas las obras.' : 'Solo la obra seleccionada.'}
          </p>
        </div>
      </div>
      {!groups.length ? (
        <div className="panel empty">
          <h3>Aún no hay muestras reales validadas</h3>
          <p>
            Los registros de prueba y pendientes no generan promedios. Empieza definiendo un grupo
            comparable.
          </p>
        </div>
      ) : (
        groups.map((g) => <GroupCard key={g.key} group={g} data={data} onSelect={setSelected} />)
      )}
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Registros de ejecución</h2>
            <p>{records.length} registros con fuente e historial</p>
          </div>
          <button
            className="icon-button"
            aria-label="Actualizar experiencia"
            disabled={busy}
            onClick={refresh}
          >
            <RefreshCw size={17} />
          </button>
        </div>
        <div className="issue-filters">
          <input
            aria-label="Buscar experiencia"
            placeholder="Buscar concepto, frente o referencia…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label="Estado de experiencia"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Todos los registros</option>
            <option value="RECORDED">Reales por validar</option>
            <option value="VALIDATED">Reales validados</option>
            <option value="test">Pruebas</option>
            <option value="VOID">Reales anulados</option>
          </select>
        </div>
        {!visible.length && (
          <div className="empty">
            <p>No hay registros en este filtro.</p>
          </div>
        )}
        {visible.map((r) => (
          <button
            className={'issue-row ' + (selected === r.id ? 'selected' : '')}
            key={r.id}
            disabled={busy}
            onClick={() => setSelected(r.id)}
          >
            <div className="issue-row-top">
              <strong>
                EXP-{r.number} · {r.reference}
              </strong>
              <span className="badge">
                {r.isTest
                  ? r.status === 'VOID'
                    ? 'Prueba anulada'
                    : 'Prueba excluida'
                  : statusLabels[r.status]}
              </span>
            </div>
            <h3>{r.budgetSnapshot.name}</h3>
            <p>
              {r.project.name} · {r.front} · {day(r.startDate)} a {day(r.endDate)}
            </p>
            <small>
              {qty(r.quantity)} {r.family.unit} · {money(r.metrics.recordedCost)} ·{' '}
              {r.coverage === 'DIRECT_COMPLETE' ? 'Directo completo declarado' : 'Solo materiales'}
            </small>
          </button>
        ))}
      </section>
      {record && (
        <EntryModal
          title={'Registro EXP-' + record.number}
          busy={busy}
          error={error}
          onClose={() => setSelected('')}
        >
          <RecordDetail
            key={record.id + ':' + record.revision}
            record={record}
            busy={busy}
            save={save}
          />
        </EntryModal>
      )}
      <details className="panel experience-form">
        <summary>Grupos comparables disponibles ({data.experience.families.length})</summary>
        {data.experience.families.map((f) => (
          <article className="experience-family" key={f.id}>
            <strong>
              {f.code} · {f.name} · {f.version} · {f.unit}
            </strong>
            <p>{f.method}</p>
            <p>{f.conditions}</p>
          </article>
        ))}
      </details>
    </div>
  );
}
