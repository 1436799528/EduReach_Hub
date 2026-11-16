import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

/**
 * UX-10 — one tab system, used everywhere.
 *
 * Before this, every tab strip in the app was hand-rolled: `role="tab"` with no
 * `tabIndex`, no arrow keys, no `tabpanel`, an active state drawn by whichever
 * stylesheet got there first, and content that hard-cut on switch. This file
 * gives the product one implementation with the rules written down:
 *
 *  - The active indicator slides with a spring; it never teleports, and its
 *    timing matches the panel fade (slow in, fast out).
 *  - Arrow keys move between tabs, Home jumps to the first, End to the last,
 *    and Tab leaves the strip for the next focusable group instead of walking
 *    through every tab.
 *  - The active ink and the focus ring are deliberately different colours, so a
 *    keyboard user can tell "where my cursor is" from "what is selected".
 *  - An overflowing strip scrolls horizontally with edge fades and, on a
 *    pointer device, chevron buttons. It never wraps to a second line.
 *  - Switching fades the old panel out, waits ~80ms, fades the new one in, and
 *    holds the previous height so the page cannot jump.
 *  - Under five tabs a phone gets a segmented control, not a shrunken bar.
 *
 * Both `TabBar` (the control only, for callers that already own the panel) and
 * `Tabs` (control + panel) are exported so a page never invents its own again.
 */

export type TabItem = {
  id: string;
  label: ReactNode;
  panel?: ReactNode;
};

type Orientation = 'horizontal';

type SharedProps = {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  /** Accessible name for the tab list. */
  label: string;
  className?: string;
  variant?: 'underline' | 'segmented';
  orientation?: Orientation;
  idPrefix?: string;
};

/**
 * Where an arrow/Home/End key should land, wrapping at both ends. Exported so
 * the behaviour can be tested without a browser, and so the tab strip is the
 * only place that decides it.
 */
export function nextTabIndex(current: number, count: number, key: string): number {
  if (count <= 0) return -1;
  const last = count - 1;
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return current >= last || current < 0 ? 0 : current + 1;
    case 'ArrowLeft':
    case 'ArrowUp':
      return current <= 0 ? last : current - 1;
    case 'Home':
      return 0;
    case 'End':
      return last;
    default:
      return -1;
  }
}

const FADE_OUT_MS = 80;
const FADE_IN_MS = 160;
const SCROLL_STEP = 180;

function useStableId(prefix: string | undefined, fallback: string) {
  const generated = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return `${prefix || fallback}-${generated}`;
}

/**
 * Measures the active tab inside the strip and exposes it as CSS variables.
 * `offsetLeft`/`offsetWidth` are used instead of `getBoundingClientRect` so a
 * horizontally scrolled strip still measures the same position.
 */
function useIndicator(stripRef: React.RefObject<HTMLDivElement | null>, value: string) {
  const [indicator, setIndicator] = useState<{ x: number; w: number } | null>(null);

  const measure = useCallback(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const active = strip.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    if (!active) return;
    const next = { x: active.offsetLeft, w: active.offsetWidth };
    setIndicator((current) => (
      current && Math.abs(current.x - next.x) < 0.5 && Math.abs(current.w - next.w) < 0.5 ? current : next
    ));
  }, [stripRef]);

  useLayoutEffect(() => { measure(); }, [measure, value]);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip || typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(strip);
    for (const child of Array.from(strip.querySelectorAll('[role="tab"]'))) observer.observe(child);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure, stripRef, value]);

  return indicator;
}

/** Which way the strip can still scroll, so the fades and chevrons tell the truth. */
function useOverflowState(stripRef: React.RefObject<HTMLDivElement | null>, count: number) {
  const [overflow, setOverflow] = useState({ left: false, right: false, scrollable: false });

  const measure = useCallback(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const left = strip.scrollLeft > 2;
    const right = strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 2;
    const scrollable = strip.scrollWidth > strip.clientWidth + 2;
    setOverflow((current) => (
      current.left === left && current.right === right && current.scrollable === scrollable
        ? current
        : { left, right, scrollable }
    ));
  }, [stripRef]);

  useEffect(() => {
    measure();
    const strip = stripRef.current;
    if (!strip) return;
    strip.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      strip.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
    // A changed tab count changes the scroll width even at the same viewport.
  }, [measure, stripRef, count]);

  return overflow;
}

export function TabBar({
  items,
  value,
  onChange,
  label,
  className,
  variant = 'underline',
  orientation = 'horizontal',
  idPrefix,
  resolvedId,
}: SharedProps & { /** Set by `Tabs` so the panel and its tab share one id base. */ resolvedId?: string }) {
  const generatedId = useStableId(idPrefix, 'er-tab');
  const baseId = resolvedId || generatedId;
  const stripRef = useRef<HTMLDivElement>(null);
  const indicator = useIndicator(stripRef, value);
  const overflow = useOverflowState(stripRef, items.length);
  // Under five tabs a phone shows a segmented control; above that the strip
  // keeps scrolling with fades, because a five-item segmented control is a
  // thumb-sized impossible.
  const mobile = items.length <= 4 ? 'segmented' : 'scroll';

  function focusTab(index: number) {
    const tabs = stripRef.current?.querySelectorAll<HTMLElement>('[role="tab"]');
    tabs?.[index]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Arrows move from wherever the keyboard actually is. Usually that is the
    // selected tab, but a pointer click can leave focus on another tab, and
    // walking from the selection would then feel like a jump.
    const focused = Array.from(stripRef.current?.querySelectorAll<HTMLElement>('[role="tab"]') || [])
      .findIndex((tab) => tab === document.activeElement);
    const current = focused >= 0 ? focused : items.findIndex((item) => item.id === value);
    if (current < 0) return;
    const horizontal = orientation === 'horizontal';
    const key = !horizontal && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')
      ? ''
      : event.key;
    const next = nextTabIndex(current, items.length, key);
    if (next < 0) return;
    event.preventDefault();
    // Automatic activation: the panel is local state, so activating on arrow is
    // cheap and matches the "indicator follows the user" expectation.
    onChange(items[next].id);
    focusTab(next);
  }

  function scrollBy(direction: -1 | 1) {
    stripRef.current?.scrollBy({ left: direction * SCROLL_STEP, behavior: 'smooth' });
  }

  return (
    <div
      className={`er-tabs-bar${className ? ` ${className}` : ''}`}
      data-variant={variant}
      data-mobile={mobile}
      data-items={items.length}
      data-overflow-left={overflow.left ? 'true' : 'false'}
      data-overflow-right={overflow.right ? 'true' : 'false'}
      data-scrollable={overflow.scrollable ? 'true' : 'false'}
    >
      <button
        type="button"
        className="er-tabs-scroll is-prev"
        aria-label="Scroll tabs left"
        tabIndex={-1}
        aria-hidden={overflow.left ? undefined : true}
        data-hidden={overflow.left ? 'false' : 'true'}
        onClick={() => scrollBy(-1)}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
      </button>

      <div
        ref={stripRef}
        className="er-tabs-strip"
        role="tablist"
        aria-label={label}
        aria-orientation={orientation}
        onKeyDown={onKeyDown}
      >
        {items.map((item) => {
          const selected = item.id === value;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={item.panel !== undefined ? `${baseId}-panel-${item.id}` : undefined}
              // One stop for the whole strip: Tab leaves the group, arrows move
              // inside it.
              tabIndex={selected ? 0 : -1}
              className={`er-tab${selected ? ' is-selected' : ''}`}
              onClick={() => onChange(item.id)}
            >
              {item.label}
            </button>
          );
        })}
        {indicator && (
          <span
            className="er-tabs-indicator"
            aria-hidden="true"
            style={{ '--er-indicator-x': `${indicator.x}px`, '--er-indicator-w': `${indicator.w}px` } as CSSProperties}
          />
        )}
      </div>

      <button
        type="button"
        className="er-tabs-scroll is-next"
        aria-label="Scroll tabs right"
        tabIndex={-1}
        aria-hidden={overflow.right ? undefined : true}
        data-hidden={overflow.right ? 'false' : 'true'}
        onClick={() => scrollBy(1)}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
      </button>
    </div>
  );
}

export default function Tabs(props: SharedProps) {
  const { items, value, idPrefix, className } = props;
  const baseId = useStableId(idPrefix, 'er-tabs');
  const panelRef = useRef<HTMLDivElement>(null);
  const [renderedId, setRenderedId] = useState(value);
  const [leaving, setLeaving] = useState(false);
  const [lockedHeight, setLockedHeight] = useState<number | null>(null);

  const withPanels = items.some((item) => item.panel !== undefined);
  const rendered = items.find((item) => item.id === renderedId) || items[0];

  useEffect(() => {
    if (value === renderedId) return;
    // Fade out, pause, fade in — never a hard cut.
    const from = panelRef.current?.offsetHeight;
    if (from) setLockedHeight(from);
    setLeaving(true);
    const timer = window.setTimeout(() => {
      setRenderedId(value);
      setLeaving(false);
    }, FADE_OUT_MS);
    const unlock = window.setTimeout(() => setLockedHeight(null), FADE_OUT_MS + FADE_IN_MS);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(unlock);
    };
  }, [value, renderedId]);

  return (
    <div className={`er-tabs${className ? ` ${className}` : ''}`} data-variant={props.variant || 'underline'}>
      <TabBar {...props} resolvedId={baseId} />
      {withPanels && (
        <div
          ref={panelRef}
          className={`er-tabs-panel${leaving ? ' is-leaving' : ' is-entering'}`}
          role="tabpanel"
          id={`${baseId}-panel-${rendered.id}`}
          aria-labelledby={`${baseId}-tab-${rendered.id}`}
          tabIndex={0}
          style={lockedHeight ? { minHeight: `${lockedHeight}px` } : undefined}
        >
          {rendered.panel}
        </div>
      )}
    </div>
  );
}

export { FADE_IN_MS, FADE_OUT_MS };
