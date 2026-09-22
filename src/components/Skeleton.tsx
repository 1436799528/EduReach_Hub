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
