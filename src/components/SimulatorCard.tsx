import { ArrowRight } from 'lucide-react';
import type { SimulatorCardModel } from '../data/simulators';

/**
 * The one simulator card.
 *
 * The homepage, the public Practice page and the authenticated CBT tab all
 * render this component, so the three surfaces cannot drift apart. The card's
 * architecture (fixed logo frame, examination label, title, description, meta
 * row and a single thin arrow) is fixed here; the only thing an examination
 * changes is its faint tint, applied by `data-exam-type` in
 * `src/styles/ux5-product.css`. The frame lets the emblem zoom on hover without
 * changing the card's footprint.
 *
 * Colour follows the examination, never the card's position, which is why the
 * tint is expressed as a data attribute rather than a generated style.
 */
export default function SimulatorCard({ simulator }: { simulator: SimulatorCardModel }) {
  const className = [
    'er-sim-card',
    simulator.examType ? `er-sim-${simulator.examType}` : 'er-sim-other',
    simulator.available ? '' : 'is-preparing',
  ].filter(Boolean).join(' ');

  const content = (
    <>
      <span className="er-sim-top">
        {/* Fixed frame: the emblem can press outward on hover without ever
            changing the card's footprint. */}
        <span className="er-sim-mark" aria-hidden="true">
          <img
            src={simulator.logo}
            alt=""
            width={40}
            height={40}
            loading="lazy"
            decoding="async"
          />
        </span>
        <span className="er-sim-badge">{simulator.label}</span>
      </span>
      <span className="er-sim-body">
        <strong>{simulator.title}</strong>
        <small>{simulator.description}</small>
        <span className="er-sim-foot">
          <span>{simulator.meta}</span>
          {simulator.available
            ? <span className="er-card-arrow" aria-hidden="true"><ArrowRight size={14} /></span>
            : null}
        </span>
      </span>
    </>
  );

  // A bank that cannot serve a session yet is described, not linked. Sending a
  // student into a setup screen that cannot start would be a broken promise.
  if (!simulator.available) {
    return (
      <div className={className} data-exam-type={simulator.examType ?? undefined} aria-disabled="true">
        {content}
      </div>
    );
  }

  return (
    <a
      className={className}
      data-exam-type={simulator.examType ?? undefined}
      href={simulator.href}
      aria-label={`${simulator.label}: ${simulator.title}`}
    >
      {content}
    </a>
  );
}
