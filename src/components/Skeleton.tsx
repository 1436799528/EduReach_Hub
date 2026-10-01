/**
 * Lightweight loading placeholders. Pages that fetch data render these instead
 * of a bare "Loading…" sentence so the layout keeps its shape while waiting.
 */
export function SkeletonRows({ rows = 4, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div className="er-skeleton-list" role="status" aria-live="polite" aria-label={label}>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="er-skeleton-row">
          <div className="er-skel er-skel-thumb" />
          <div className="er-skeleton-row-copy">
            <div className="er-skel er-skel-line" style={{ width: '38%' }} />
            <div className="er-skel er-skel-line" style={{ width: '92%' }} />
            <div className="er-skel er-skel-line" style={{ width: '64%' }} />
          </div>
        </div>
      ))}
      <span className="er-visually-hidden">{label}…</span>
    </div>
  );
}

export function SkeletonArticle() {
  return (
    <div className="er-skeleton-card er-skeleton-article" role="status" aria-live="polite" aria-label="Loading article">
      <div className="er-skel er-skel-line" style={{ width: '24%' }} />
      <div className="er-skel er-skel-line" style={{ width: '88%', height: 22 }} />
      <div className="er-skel er-skel-line" style={{ width: '70%', height: 22 }} />
      <div className="er-skel er-skel-block" style={{ height: 200 }} />
      <div className="er-skel er-skel-line" style={{ width: '96%' }} />
      <div className="er-skel er-skel-line" style={{ width: '90%' }} />
      <div className="er-skel er-skel-line" style={{ width: '60%' }} />
    </div>
  );
}

/** Shown while a lazily loaded route chunk downloads (see src/app/routes.tsx). */
export function RouteFallback() {
  return (
    <div className="er-route-fallback" role="status" aria-live="polite" aria-label="Loading page">
      <div className="er-route-fallback-bar" />
      <div className="er-route-fallback-body">
        <div className="er-skel er-skel-line" style={{ width: '32%', height: 22 }} />
        <div className="er-skel er-skel-line" style={{ width: '58%' }} />
        <SkeletonRows rows={3} label="Loading page" />
      </div>
    </div>
  );
}

/**
 * Card placeholders for a grid that fills in after the first paint. The box
 * mirrors the cards it stands in for — same padding, same radius, same
 * two-column grid (see .er-library-grid) — so the region is the same height
 * before and after the data lands and nothing below it moves. PERF-1 measured
 * the alternative: CLS 0.31 on /past-questions with a throttled phone.
 */
export function SkeletonTiles({
  tiles = 6,
  label = 'Loading',
  className = 'er-skeleton-grid',
}: {
  tiles?: number;
  label?: string;
  /** The grid class of the cards being replaced, so the placeholder lays out the same way. */
  className?: string;
}) {
  return (
    <div className={className} role="status" aria-live="polite" aria-label={label}>
      {Array.from({ length: tiles }).map((_, index) => (
        <div key={index} className="er-skeleton-tile">
          <div className="er-skel er-skel-thumb" style={{ width: 34, height: 34, borderRadius: 9 }} />
          <div className="er-skel er-skel-line" style={{ width: '68%', height: 17 }} />
          <div className="er-skel er-skel-line" style={{ width: '94%' }} />
          <div className="er-skel er-skel-line" style={{ width: '62%' }} />
          <div className="er-skel er-skel-block" style={{ height: 36, marginTop: 'auto' }} />
        </div>
      ))}
      <span className="er-visually-hidden">{label}…</span>
    </div>
  );
}
