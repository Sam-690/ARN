'use client';
import { useEffect, useRef, useState } from 'react';
import type { Data, ForecastResult } from '../../types';
import { ForecastParameters } from './forecast-parameters';
import { ForecastProjection } from './forecast-projection';
import { SupplierHistory } from './supplier-history';
import { day, freshOption, Option } from './helpers';
import { SupplyComparison } from './supply-comparison';
export function ForecastPanel({
  data,
  projectId,
  onSupply,
}: {
  data: Data;
  projectId: string;
  onSupply: (projectId: string) => void;
}) {
  const [target, setTarget] = useState(
      projectId === 'all' ? data.projects.find((p) => p.status === 'ACTIVE')?.id || '' : projectId,
    ),
    [material, setMaterial] = useState(data.materials.find((m) => m.type === 'MATERIAL')?.id || ''),
    [horizon, setHorizon] = useState('28'),
    [lead, setLead] = useState('5'),
    [safety, setSafety] = useState('2');
  const [result, setResult] = useState<ForecastResult | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [options, setOptions] = useState<Option[]>([freshOption()]),
    [amount, setAmount] = useState(''),
    [needed, setNeeded] = useState(day()),
    [comparisonDirty, setComparisonDirty] = useState(false);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null),
    request = useRef(0);
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );
  const m = data.materials.find((m) => m.id === material),
    p = data.projects.find((p) => p.id === target);
  function invalidate() {
    request.current++;
    setBusy(false);
    setResult(null);
    setError('');
    setOptions([freshOption()]);
    setComparisonDirty(false);
  }
  function editOption(index: number, patch: Partial<Option>) {
    setOptions(
      options.map((o, i) =>
        i === index ? { ...o, ...patch, confirmed: patch.confirmed ?? false } : o,
      ),
    );
    setComparisonDirty(true);
  }
  async function calculate(compare = false) {
    const id = ++request.current;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/supply/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: target,
          materialId: material,
          horizon: Number(horizon),
          leadDays: Number(lead),
          safetyDays: Number(safety),
          ...(compare
            ? {
                comparison: {
                  quantity: Number(amount),
                  neededOn: needed,
                  options: options.map((o) => ({
                    ...o,
                    unitPrice: Number(o.unitPrice),
                    freight: Number(o.freight),
                  })),
                },
              }
            : {}),
        }),
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.message || 'No se pudo calcular el escenario');
      if (id !== request.current) return;
      setResult(value);
      setComparisonDirty(false);
      if (!compare) {
        setAmount(Number(value.required) > 0 ? value.required : '');
        setNeeded(value.firstShortage || day());
        setOptions([freshOption()]);
      } else {
        setComparisonOpen(false);
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (e) {
      if (id === request.current) setError((e as Error).message);
    } finally {
      if (id === request.current) setBusy(false);
    }
  }
  function exportScenario() {
    if (!result) return;
    const blob = new Blob(
      [
        JSON.stringify(
          {
            title: 'Escenario de abastecimiento — no es una orden',
            project: p?.name,
            material: m?.name,
            unit: m?.unit,
            assumptions:
              'Máximo acumulado entre necesidades y tendencia; días naturales; costos netos MXN; flete no capitalizado; sin reservas.',
            ...result,
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = `abastecimiento-${p?.code}-${result.asOf}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="experience-module forecast-module">
      <ForecastParameters
        calculate={calculate}
        busy={busy}
        projectId={projectId}
        target={target}
        invalidate={invalidate}
        setTarget={setTarget}
        data={data}
        material={material}
        setMaterial={setMaterial}
        horizon={horizon}
        setHorizon={setHorizon}
        lead={lead}
        setLead={setLead}
        safety={safety}
        setSafety={setSafety}
        p={p}
        error={error}
      />
      {result && (
        <>
          <ForecastProjection
            p={p}
            m={m}
            result={result}
            exportScenario={exportScenario}
            comparisonDirty={comparisonDirty}
          />
          <SupplierHistory result={result} data={data} />
          <SupplyComparison
            busy={busy}
            setComparisonOpen={setComparisonOpen}
            comparisonOpen={comparisonOpen}
            error={error}
            calculate={calculate}
            m={m}
            amount={amount}
            setAmount={setAmount}
            setOptions={setOptions}
            options={options}
            setComparisonDirty={setComparisonDirty}
            needed={needed}
            setNeeded={setNeeded}
            editOption={editOption}
            result={result}
            resultsRef={resultsRef}
            comparisonDirty={comparisonDirty}
            onSupply={onSupply}
            target={target}
          />
        </>
      )}
    </div>
  );
}
