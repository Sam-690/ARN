'use client';
import { Download } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { SourceDocument } from '../../types';
export function Preview({ doc }: { doc: SourceDocument }) {
  const [page, setPage] = useState(1),
    [pages, setPages] = useState(1),
    [error, setError] = useState(''),
    host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (doc.mime !== 'application/pdf') return;
    let alive = true,
      task: any,
      render: any;
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-label', 'Página del documento original');
    host.current?.replaceChildren(canvas);
    setError('');
    (async () => {
      const pdfjs = await import('pdfjs-dist');
      if (!alive) return;
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
      task = pdfjs.getDocument({
        url: `/api/documents/${doc.id}/file`,
        withCredentials: true,
        enableXfa: false,
        cMapUrl: '/pdfjs/cmaps/',
        cMapPacked: true,
        standardFontDataUrl: '/pdfjs/standard_fonts/',
        wasmUrl: '/pdfjs/wasm/',
      });
      const pdf = await task.promise;
      if (!alive) return;
      setPages(pdf.numPages);
      const sheet = await pdf.getPage(page);
      if (!alive) return;
      const v = sheet.getViewport({ scale: 1 }),
        viewport = sheet.getViewport({ scale: Math.min(2, 1600 / Math.max(v.width, v.height)) });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      render = sheet.render({ canvas, viewport });
      await render.promise;
    })().catch(() => {
      if (alive) setError('No se pudo mostrar el original. Descárgalo para revisarlo.');
    });
    return () => {
      alive = false;
      render?.cancel();
      void task?.destroy();
    };
  }, [doc.id, doc.mime, page]);
  return (
    <section className="document-original">
      <div className="panel-head">
        <h3>Original conservado</h3>
        <a className="text-button" href={`/api/documents/${doc.id}/file`} download>
          <Download size={15} />
          Descargar
        </a>
      </div>
      <p className="small-note">
        {doc.name} ·{' '}
        {doc.size < 1048576
          ? (doc.size / 1024).toFixed(1) + ' KB'
          : (doc.size / 1048576).toFixed(2) + ' MB'}
      </p>
      {doc.mime === 'application/pdf' ? (
        <>
          <div className="log-actions">
            <button
              type="button"
              className="secondary"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Anterior
            </button>
            <span>
              {page} / {pages}
            </span>
            <button
              type="button"
              className="secondary"
              disabled={page === pages}
              onClick={() => setPage(page + 1)}
            >
              Siguiente
            </button>
          </div>
          <div ref={host} className="document-preview" />
          {error && <p role="alert">{error}</p>}
        </>
      ) : (
        <img
          className="document-image"
          src={`/api/documents/${doc.id}/file`}
          alt="Documento original para cotejar la captura"
        />
      )}
    </section>
  );
}
