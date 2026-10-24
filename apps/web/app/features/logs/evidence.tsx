'use client';
import { FileText } from 'lucide-react';
import { useState } from 'react';
import type { LogAttachment } from '../../types';
import { Save, time } from './helpers';
export function Evidence({
  attachment: a,
  logId,
  busy,
  transcription,
  save,
  review,
  canWrite,
}: {
  attachment: LogAttachment;
  logId: string;
  busy: boolean;
  transcription: boolean;
  save: Save;
  review: (a: LogAttachment) => void;
  canWrite: boolean;
}) {
  const [consent, setConsent] = useState(false);
  const url = `/api/logs/${logId}/attachments/${a.id}`;
  return (
    <article className="evidence-card">
      {a.mime.startsWith('image/') ? (
        <a href={url} target="_blank" rel="noreferrer">
          <img src={url} alt={a.caption} loading="lazy" />
        </a>
      ) : (
        <audio controls src={url} preload="none" />
      )}
      <strong>{a.caption}</strong>
      <p>
        {a.name} · {(a.size / 1024 / 1024).toFixed(2)} MB
      </p>
      <small>
        {a.author} · {time(a.createdAt)}
      </small>
      <a className="text-button" href={url} target="_blank" rel="noreferrer">
        Abrir original
      </a>
      {a.mime.startsWith('audio/') && (
        <>
          {a.transcript ? (
            <div className="transcript-preview">
              <span>Transcripción automática · revisar</span>
              <p className="preserve">{a.transcript}</p>
              {a.publishedAddendum ? (
                <small>Incorporada como adenda revisada.</small>
              ) : (
                <button
                  className="text-button"
                  disabled={busy || !canWrite}
                  onClick={() => review(a)}
                >
                  Revisar e incorporar como adenda
                </button>
              )}
            </div>
          ) : (
            <div className="transcription-action">
              {transcription && canWrite ? (
                <>
                  <label className="history-toggle">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      disabled={busy}
                    />
                    Enviar este audio a OpenAI para transcribirlo
                  </label>
                  <button
                    className="secondary"
                    disabled={busy || !consent}
                    onClick={() =>
                      save(
                        `logs/${logId}/attachments/${a.id}/transcribe`,
                        { sendToOpenAI: true },
                        'Transcripción preparada; revísala antes de incorporarla',
                      )
                    }
                  >
                    <FileText size={15} />
                    {a.transcriptionStatus === 'PROCESSING'
                      ? 'Consultar / reintentar'
                      : 'Transcribir audio'}
                  </button>
                  {a.transcriptionStatus === 'ERROR' && (
                    <small>No se completó la transcripción. El audio se conserva.</small>
                  )}
                </>
              ) : (
                <p>
                  {canWrite
                    ? 'Transcripción pendiente de configurar. Puedes escuchar la grabación.'
                    : 'Audio conservado en una obra cerrada.'}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </article>
  );
}
