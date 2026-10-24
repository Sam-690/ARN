'use client';
import { Mic, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { fileLimit } from './helpers';
export function Recorder({
  onFile,
  onBusy,
  disabled,
}: {
  onFile: (file: File) => void;
  onBusy: (value: boolean) => void;
  disabled: boolean;
}) {
  const [recording, setRecording] = useState(false),
    [seconds, setSeconds] = useState(0),
    [error, setError] = useState('');
  const recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    timer = useRef<ReturnType<typeof setInterval> | null>(null),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (timer.current) clearInterval(timer.current);
      if (recorder.current?.state === 'recording') recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  async function start() {
    setError('');
    onBusy(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined')
        throw new Error('Este navegador no permite grabar. Puedes adjuntar un archivo de audio.');
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find((m) =>
        MediaRecorder.isTypeSupported(m),
      );
      const rec = new MediaRecorder(media, mime ? { mimeType: mime } : undefined);
      recorder.current = rec;
      let chunks: Blob[] = [],
        bytes = 0;
      setSeconds(0);
      setRecording(true);
      rec.ondataavailable = (e) => {
        if (e.data.size) {
          chunks.push(e.data);
          bytes += e.data.size;
          if (bytes > fileLimit && rec.state === 'recording') rec.stop();
        }
      };
      rec.onstop = () => {
        media.getTracks().forEach((t) => t.stop());
        if (timer.current) clearInterval(timer.current);
        if (!alive.current) return;
        setRecording(false);
        onBusy(false);
        if (bytes > fileLimit) {
          setError('La grabación superó 8 MB. Graba una nota más corta.');
          return;
        }
        const type = rec.mimeType.split(';')[0];
        const ext = type === 'audio/mp4' ? 'm4a' : type === 'audio/ogg' ? 'ogg' : 'webm';
        onFile(new File(chunks, `Nota-de-voz-${Date.now()}.${ext}`, { type }));
      };
      rec.onerror = () => {
        setError('Se interrumpió la grabación. Revisa el audio antes de guardarlo.');
        if (rec.state === 'recording') rec.stop();
        else {
          media.getTracks().forEach((t) => t.stop());
          if (timer.current) clearInterval(timer.current);
          setRecording(false);
          onBusy(false);
        }
      };
      rec.start(1000);
      const started = Date.now();
      timer.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - started) / 1000);
        setSeconds(elapsed);
        if (elapsed >= 300 && rec.state === 'recording') rec.stop();
      }, 500);
    } catch (e) {
      stream.current?.getTracks().forEach((t) => t.stop());
      if (alive.current) {
        setRecording(false);
        onBusy(false);
        setError(
          (e as Error).name === 'NotAllowedError'
            ? 'No se autorizó el micrófono. Puedes permitirlo o adjuntar un audio.'
            : (e as Error).message,
        );
      }
    }
  }
  return (
    <div className="voice-control">
      {recording ? (
        <button
          type="button"
          className="secondary recording"
          onClick={() => recorder.current?.stop()}
        >
          <Square size={15} />
          Detener · {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
        </button>
      ) : (
        <button type="button" className="secondary" disabled={disabled} onClick={start}>
          <Mic size={16} />
          Grabar voz
        </button>
      )}
      <span>Máximo 5 minutos · se guarda solo al confirmar</span>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}
