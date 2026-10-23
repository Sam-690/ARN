'use client';
import { useEffect, useRef, useState } from 'react';
import type { DrawingVersion, PlanIssue } from './types';
export function PlanViewer({
  drawingId,
  version,
  page,
  issues,
  selectedId,
  onSelect,
  onPlace,
  placing,
  zoom,
}: {
  drawingId: string;
  version: DrawingVersion;
  page: number;
  issues: PlanIssue[];
  selectedId: string;
  onSelect: (issue: PlanIssue) => void;
  onPlace: (point: { x: number; y: number }) => void;
  placing: boolean;
  zoom: number;
}) {
  const host = useRef<HTMLDivElement>(null),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    let alive = true,
      task: any,
      render: any;
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-label', `Plano, versión ${version.number}, página ${page}`);
    canvas.setAttribute('role', 'img');
    setLoaded(false);
    setError('');
    host.current?.replaceChildren(canvas);
    (async () => {
      const pdfjs = await import('pdfjs-dist');
      if (!alive) return;
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
      task = pdfjs.getDocument({
        url: `/api/drawings/${drawingId}/versions/${version.id}/file`,
        withCredentials: true,
        enableXfa: false,
        cMapUrl: '/pdfjs/cmaps/',
        cMapPacked: true,
        standardFontDataUrl: '/pdfjs/standard_fonts/',
        wasmUrl: '/pdfjs/wasm/',
      });
      const doc = await task.promise;
      if (!alive) return;
      const sheet = await doc.getPage(page);
      if (!alive) return;
      const original = sheet.getViewport({ scale: 1 });
      const scale = Math.min(2, 1800 / Math.max(original.width, original.height));
      const viewport = sheet.getViewport({ scale });
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      render = sheet.render({ canvas, viewport });
      await render.promise;
      if (alive) setLoaded(true);
    })().catch(() => {
      if (alive)
        setError(
          'No se pudo mostrar esta página. Descarga el PDF para revisarlo o carga una versión compatible.',
        );
    });
    return () => {
      alive = false;
      render?.cancel();
      void task?.destroy();
    };
  }, [drawingId, version.id, version.number, page]);
  return (
    <>
      <div className="plan-scroll">
        <div
          className={'plan-sheet ' + (placing ? 'placing' : '')}
          style={{ width: zoom + '%' }}
          onClick={(e) => {
            if (!placing || !loaded) return;
            const rect = e.currentTarget.getBoundingClientRect();
            onPlace({
              x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
              y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
            });
          }}
        >
          <div ref={host} className="plan-canvas" />
          {loaded &&
            issues.map((i) => (
              <button
                key={i.id}
                style={{ left: i.x * 100 + '%', top: i.y * 100 + '%' }}
                className={'plan-pin ' + i.status + (selectedId === i.id ? ' selected' : '')}
                aria-label={`Incidencia ${i.number}: ${i.title}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(i);
                }}
              >
                {i.number}
              </button>
            ))}
        </div>
      </div>
      {!loaded && !error && (
        <p role="status" className="small-note">
          Preparando página del plano…
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
