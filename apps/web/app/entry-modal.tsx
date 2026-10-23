'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
/** Mount only while open. Native modal semantics trap focus and restore the trigger. */
export function EntryModal({
  title,
  busy = false,
  error,
  wide = false,
  onClose,
  children,
}: {
  title: string;
  busy?: boolean;
  error?: string;
  wide?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return createPortal(
    <dialog
      ref={ref}
      aria-label={title}
      className={'entry-modal' + (wide ? ' entry-modal-wide' : '')}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <div className="entry-modal-bar">
        <span>{title}</span>
        <button
          type="button"
          className="icon-button"
          aria-label="Cerrar ventana de captura"
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <div className="entry-modal-body">
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {children}
      </div>
    </dialog>,
    document.body,
  );
}
