import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

/**
 * UI-5 / UX-10 — small, non-blocking feedback.
 *
 * A toast is for the sentence the interface owes after a low-risk action:
 * "Profile saved", "Copied to clipboard". It is deliberately not a modal, not
 * a second place errors live, and not the only confirmation for something
 * consequential: a destructive action keeps its inline/confirmation state, and
 * a failed save keeps its error on the form. This component never replaces
 * those; it adds the reassurance beside them.
 *
 * UX-10 rules applied here:
 *  - The countdown matches the severity: routine info and success clear in 4s,
 *    a warning holds for 7s, and a failure (danger) never disappears on its own
 *    — the person has to acknowledge it.
 *  - Hovering or focusing a toast pauses its countdown, so nobody loses a
 *    sentence mid-read, and it resumes with the time that was left.
 *  - Three are visible at once; the newest enters at the bottom and the rest
 *    wait their turn instead of piling up.
 *  - On a phone the viewport lifts above the fixed tab bar (see
 *    src/styles/ux9-microinteractions.css) and a horizontal swipe dismisses.
 *  - Type is never carried by colour alone: each tone pairs a colour with its
 *    own icon and a left accent border.
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
/** How long each severity stays before it clears itself. 0 = until dismissed. */
export const DURATION_BY_TONE: Record<ToastTone, number> = {
  success: 4000,
  info: 4000,
  warning: 7000,
  danger: 0,
};
export const TOAST_EXIT_MS = 150;
export const TOAST_SWIPE_THRESHOLD = 64;

const ICONS: Record<ToastTone, ReactNode> = {
  success: <CheckCircle2 size={18} />,
  info: <Info size={18} />,
  warning: <AlertTriangle size={18} />,
  danger: <XCircle size={18} />,
};

function ToastCard({
  item,
  tone,
  onDismiss,
}: {
  item: ToastItem;
  tone: ToastTone;
  onDismiss: (id: number) => void;
}) {
  const duration = item.duration ?? DURATION_BY_TONE[tone];
  const [paused, setPaused] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const remaining = useRef(duration);
  const startedAt = useRef(0);
  const dismissTimer = useRef<number | null>(null);

  const finish = useCallback(() => {
    setLeaving(true);
    dismissTimer.current = window.setTimeout(() => onDismiss(item.id), TOAST_EXIT_MS);
  }, [item.id, onDismiss]);

  // The countdown is real time minus the time already spent visible, so a pause
  // resumes where it stopped instead of restarting the whole duration.
  useEffect(() => {
    if (duration <= 0 || paused || leaving) return;
    startedAt.current = Date.now();
    const timer = window.setTimeout(finish, remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
    };
  }, [duration, paused, leaving, finish]);

  useEffect(() => () => {
    if (dismissTimer.current) window.clearTimeout(dismissTimer.current);
  }, []);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'touch') return;
    const startX = event.clientX;
    setDragging(true);
    setPaused(true);
    const move = (moveEvent: PointerEvent) => setDragX(moveEvent.clientX - startX);
    const up = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setDragging(false);
      const travelled = upEvent.clientX - startX;
      setDragX(0);
      if (Math.abs(travelled) >= TOAST_SWIPE_THRESHOLD) finish();
      else setPaused(false);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  return (
    <div
      className={`er-toast er-toast--${tone}`}
      role={tone === 'danger' ? 'alert' : 'status'}
      aria-live={tone === 'danger' ? 'assertive' : 'polite'}
      data-dragging={dragging ? 'true' : 'false'}
      data-leaving={leaving ? 'true' : 'false'}
      style={{ '--er-toast-drag': `${dragX}px` } as CSSProperties}
      onPointerDown={onPointerDown}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);
      }}
    >
      <span className="er-toast-icon" aria-hidden="true">{ICONS[tone]}</span>
      <div className="er-toast-copy">
        <strong>{item.title}</strong>
        {item.detail && <p>{item.detail}</p>}
      </div>
      <button
        type="button"
        className="er-toast-close"
        aria-label={tone === 'danger' ? 'Acknowledge and dismiss alert' : 'Dismiss notification'}
        onClick={finish}
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const push = useCallback((toast: ToastInput) => {
    const id = nextId.current++;
    // Everything is kept; only the newest three render, so a burst queues
    // instead of evicting the message someone has not read yet.
    // A hard cap keeps a runaway caller from growing this list forever.
    setItems((current) => [...current, { ...toast, id }].slice(-12));
    return id;
  }, []);

  const visible = items.slice(-MAX_VISIBLE);

  return (
    <ToastContext.Provider value={{ push, dismiss }}>
      {children}
      <div className="er-toast-viewport">
        {visible.map((item) => {
          const tone = item.tone || 'info';
          return <ToastCard key={item.id} item={item} tone={tone} onDismiss={dismiss} />;
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
