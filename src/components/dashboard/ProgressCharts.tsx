import type { CSSProperties } from 'react';
import type {
  DistributionBucket,
  SubjectPerformance,
  TrendPoint,
} from '../../lib/dashboardAnalytics';

/**
 * UI-5 — charts that fit the data.
 *
 * A bar answers "which subject?", a histogram answers "how are my scores
 * spread?", and a line answers "am I moving?". None of them is decorative:
 * each one is the only chart that shows its question honestly.
 *
 * They are plain SVG and CSS, with no chart dependency. The bars keep a neutral
 * fill; colour is used only for a movement or a band, so a wall of green never
 * implies four separate successes. Every chart carries a text alternative that
 * states the numbers, not just "a chart".
 */

export function ChangeChip({ change, suffix = 'pts' }: { change: number; suffix?: string }) {
  if (change === 0) {
    return <span className="dash-change is-flat">No change</span>;
  }
  const up = change > 0;
  return (
    <span className={`dash-change ${up ? 'is-up' : 'is-down'}`}>
      <span aria-hidden="true">{up ? '↑' : '↓'}</span>
      {up ? '+' : '−'}{Math.abs(change)} {suffix}
    </span>
  );
}

export function TrendChart({ points }: { points: TrendPoint[] }) {
  if (points.length < 2) {
    return (
      <p className="dash-chart-empty">
        Complete two scored papers to see a trend. One score is a result, not a direction.
      </p>
    );
  }

  const width = 320;
  const height = 150;
  const pad = { top: 12, right: 10, bottom: 24, left: 28 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const x = (index: number) => pad.left + (points.length === 1 ? 0 : (index / (points.length - 1)) * plotWidth);
  const y = (score: number) => pad.top + ((100 - Math.max(0, Math.min(100, score))) / 100) * plotHeight;

  const line = points.map((point, index) => `${x(index)},${y(point.score)}`).join(' ');
  const area = `${pad.left},${pad.top + plotHeight} ${line} ${pad.left + plotWidth},${pad.top + plotHeight}`;
  const first = points[0];
  const last = points[points.length - 1];
  const direction = last.score > first.score ? 'up' : last.score < first.score ? 'down' : 'flat';
  const description = `Scores across ${points.length} scored papers: ${points
    .map((point) => `${point.label} ${point.score} percent`)
    .join(', ')}. Overall ${direction === 'flat' ? 'unchanged' : `${direction} ${Math.abs(last.score - first.score)} points`}.`;

  return (
    <svg
      className="dash-trend-chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={description}
      preserveAspectRatio="none"
    >
      {[0, 50, 100].map((tick) => (
        <g key={tick}>
          <line
            x1={pad.left}
            x2={width - pad.right}
            y1={y(tick)}
            y2={y(tick)}
            stroke="#e2e8f0"
            strokeDasharray={tick === 0 ? undefined : '3 4'}
          />
          <text x={pad.left - 6} y={y(tick) + 3} textAnchor="end" fontSize="9" fill="#64748b">{tick}</text>
        </g>
      ))}
      <polygon points={area} fill="rgba(23, 74, 58, .07)" />
      <polyline
        points={line}
        fill="none"
        stroke="#64748b"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {points.map((point, index) => {
        const isLast = index === points.length - 1;
        const tone = isLast ? (direction === 'down' ? '#b91c1c' : direction === 'up' ? '#166534' : '#64748b') : '#ffffff';
        return (
          <circle
            key={`${point.at}-${index}`}
            cx={x(index)}
            cy={y(point.score)}
            r={isLast ? 4 : 2.6}
            fill={tone}
            stroke={isLast ? tone : '#64748b'}
            strokeWidth="1.6"
          />
        );
      })}
      <text x={x(0)} y={height - 7} textAnchor="start" fontSize="9" fill="#64748b">{first.label}</text>
      <text x={x(points.length - 1)} y={height - 7} textAnchor="end" fontSize="9" fill="#64748b">{last.label}</text>
    </svg>
  );
}

export function DistributionChart({ buckets, total }: { buckets: DistributionBucket[]; total: number }) {
  const max = Math.max(1, ...buckets.map((bucket) => bucket.count));
  const summary = buckets
    .filter((bucket) => bucket.count > 0)
    .map((bucket) => `${bucket.label}: ${bucket.count}`)
    .join(', ');
  return (
    <div
      className="dash-distribution"
      role="img"
      aria-label={total ? `Score distribution across ${total} scored papers. ${summary}.` : 'No scored papers to distribute yet.'}
    >
      {buckets.map((bucket) => (
        <div className="dash-distribution-col" key={bucket.id} aria-hidden="true">
          <span className="dash-distribution-count">{bucket.count || ''}</span>
          <span
            className={`dash-distribution-bar${bucket.count ? '' : ' is-empty'}`}
            style={{ height: `${bucket.count ? Math.max(4, (bucket.count / max) * 100) : 2}%` } as CSSProperties}
          />
          <span className="dash-distribution-label">{bucket.label}</span>
        </div>
      ))}
    </div>
  );
}

export function SubjectBars({ rows }: { rows: SubjectPerformance[] }) {
  const ordered = [...rows].sort((a, b) => b.average - a.average || a.subject.localeCompare(b.subject));
  return (
    <ul className="dash-subject-bars">
      {ordered.map((row) => (
        <li key={row.subject}>
          <div className="dash-subject-bar-head">
            <strong>{row.subject}</strong>
            <span>{row.average}%</span>
          </div>
          <div
            className="dash-subject-track"
            role="img"
            aria-label={`${row.subject}: ${row.average} percent across ${row.attempts} scored ${row.attempts === 1 ? 'paper' : 'papers'}`}
          >
            <span style={{ width: `${Math.max(2, Math.min(100, row.average))}%` } as CSSProperties} />
          </div>
          <div className="dash-subject-bar-meta">
            <span>{row.attempts} {row.attempts === 1 ? 'paper' : 'papers'} · {row.questions} questions</span>
            {row.change !== null && <ChangeChip change={row.change} />}
            <span className={`dash-band is-${row.band}`}>
              {row.band === 'strong' ? 'Strong' : row.band === 'building' ? 'Building' : 'Needs practice'}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
