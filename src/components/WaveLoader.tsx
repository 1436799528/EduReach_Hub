import type { CSSProperties } from 'react';

const BAR_COUNT = 4;

/**
 * UI-2 — the one loading indicator for a request that is genuinely pending.
 *
 * A dual arc drawn in SVG (two dash patterns on the same circle, turning at
 * different speeds) around a four-bar waveform. It is pure CSS and one inline
 * SVG: no animation library, no canvas, no measurement.
 *
 * The colour is `currentColor`, so the same control stays legible on a white
 * card, inside the crimson call to action and on the dark admin sidebar
 * without a variant per surface.
 *
 * Accessibility: the default form is a `role="status"` live region that
 * announces its label once. Inside a button, where the visible text already
 * says "Starting…", pass `decorative` so the screen reader hears one message
 * rather than two. Motion is stopped by the reduced-motion rules in
 * `src/styles/a11y.css` and `src/styles/type-system.css`.
 */
export default function WaveLoader({
  label,
  variant = 'ring',
  decorative = false,
  className = '',
}: {
  /** Visible text. Also the accessible name; omit inside a labelled control. */
  label?: string;
  /** `ring` is standalone, `inline` is the bar-only form for buttons and rows. */
  variant?: 'ring' | 'inline';
  /** Hide from assistive technology when surrounding text already announces. */
  decorative?: boolean;
  className?: string;
}) {
  const classes = ['er-wave', variant === 'inline' ? 'er-wave--inline' : '', className]
    .filter(Boolean)
    .join(' ');
  const announcement = decorative
    ? { 'aria-hidden': true as const }
    : { role: 'status' as const, 'aria-live': 'polite' as const };

  const bars = (
    <span className="er-wave-bars" aria-hidden="true">
      {Array.from({ length: BAR_COUNT }).map((_, index) => (
        <i key={index} style={{ '--er-wave-step': index } as CSSProperties} />
      ))}
    </span>
  );

  return (
    <span className={classes} {...announcement}>
      {variant === 'ring' ? (
        <span className="er-wave-ring" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <circle className="er-wave-track" cx="12" cy="12" r="9" />
            <circle className="er-wave-arc" cx="12" cy="12" r="9" />
            <circle className="er-wave-arc er-wave-arc-2" cx="12" cy="12" r="9" />
          </svg>
          {bars}
        </span>
      ) : (
        bars
      )}
      {label && <span className="er-wave-label">{label}</span>}
      {!decorative && !label && <span className="er-visually-hidden">Loading</span>}
    </span>
  );
}
