import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

/**
 * UI-5 — small, non-blocking feedback.
 *
 * A toast is for the sentence the interface owes after a low-risk action:
 * "Profile saved", "Copied to clipboard". It is deliberately not a modal, not
 * a second place errors live, and not the only confirmation for something
 * consequential: a destructive action keeps its inline/confirmation state, and
 * a failed save keeps its error on the form. This component never replaces
 * those; it adds the reassurance beside them.
 *
 * Three visible at a time, auto-dismissed after five seconds, dismissible with a
 * normal button, announced politely (assertively for a failure). The viewport is
 * fixed so it cannot push content, and it sits above the page but below a modal.
 */

export type ToastTone = 'success' | 'info' | 'warning' | 'danger';

export type ToastInput = {
  title: string;
  detail?: string;
  tone?: ToastTone;
  /** Milliseconds before auto-dismiss. Pass 0 to keep it until dismissed. */
  duration?: number;
};

type ToastItem = ToastInput & { id: number };

type ToastContextValue = {
  push: (toast: ToastInput) => number;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_VISIBLE = 3;
const DEFAULT_DURATION = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const push = useCallback((toast: ToastInput) => {
    const id = nextId.current++;
    setItems((current) => [...current, { ...toast, id }].slice(-MAX_VISIBLE));
    const duration = toast.duration ?? DEFAULT_DURATION;
    if (duration > 0) {
      const timer = window.setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);
    }
    return id;
  }, [dismiss]);

  useEffect(() => () => {
    for (const timer of timers.current.values()) window.clearTimeout(timer);
    timers.current.clear();
  }, []);

  return (
    <ToastContext.Provider value={{ push, dismiss }}>
      {children}
      <div className="er-toast-viewport">
        {items.map((item) => {
          const tone = item.tone || 'info';
          return (
            <div
              key={item.id}
              className={`er-toast er-toast--${tone}`}
              role={tone === 'danger' ? 'alert' : 'status'}
              aria-live={tone === 'danger' ? 'assertive' : 'polite'}
            >
              <span className="er-toast-icon" aria-hidden="true">
                {tone === 'success' ? <CheckCircle2 size={18} />
                  : tone === 'warning' ? <AlertTriangle size={18} />
                  : tone === 'danger' ? <XCircle size={18} />
                  : <Info size={18} />}
              </span>
              <div className="er-toast-copy">
                <strong>{item.title}</strong>
                {item.detail && <p>{item.detail}</p>}
              </div>
              <button
                type="button"
                className="er-toast-close"
                aria-label="Dismiss notification"
                onClick={() => dismiss(item.id)}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
