import { useEffect, useMemo, useState } from 'react';
import SimulatorCard from './SimulatorCard';
import { ErrorState } from './AsyncState';
import { SkeletonTiles } from './Skeleton';
import WaveLoader from './WaveLoader';
import FilterPills from './FilterPills';
import { fetchCbtExams, fetchCbtExamsWithAvailability, type CbtExamSummary } from '../lib/api';
import { usePendingPhase } from '../lib/usePendingPhase';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  buildSimulatorCards,
  filterSimulatorCards,
  simulatorExamType,
  simulatorFilters,
  type SimulatorCardModel,
} from '../data/simulators';

// One definition of the canonical examination types lives in
// src/data/simulators.ts; these re-exports keep older imports working.
export { SIMULATOR_EXAM_TYPES, simulatorExamType, simulatorStartHref } from '../data/simulators';
export type { SimulatorExamType } from '../data/simulators';

/**
 * The simulator catalogue, rendered the same way on every surface.
 *
 * Homepage, public Practice and the authenticated CBT tab each mount this
 * component. The grid is data-driven: a card exists only because the published
 * question-bank catalogue returned a bank for that examination, and the cards
 * themselves are the shared `SimulatorCard`.
 *
 * `showFilters` adds the examination filter row (Practice and the dashboard
 * CBT tab); the homepage keeps the short, unfiltered discovery list.
 */
export default function ExamSimulatorGrid({
  showFilters = false,
  emptyMessage = 'No active public question banks are connected right now. Browse past questions while the bank catalogue is updated.',
  initialFilter = 'ALL',
  onFilterChange,
  initialCards,
  deferCatalogue = false,
}: {
  showFilters?: boolean;
  emptyMessage?: string;
  /** A canonical exam type (or any spelling of one) to open the grid filtered. */
  initialFilter?: string;
  /** Lets the host page keep the address bar in step with the chosen filter. */
  onFilterChange?: (id: string) => void;
  /** Built-in discovery cards shown immediately while bank data is deferred. */
  initialCards?: readonly SimulatorCardModel[];
  /** Skip the catalogue request; the destination loads bank data when opened. */
  deferCatalogue?: boolean;
}) {
  const showBuiltInCards = deferCatalogue && Boolean(initialCards?.length);
  const [exams, setExams] = useState<CbtExamSummary[]>([]);
  const [error, setError] = useState<unknown>(null);
  // Whether the catalogue has answered at all. Until it has, the section shows
  // placeholders: claiming "no question banks have been published" while the
  // request is still in flight is both wrong and a layout jump when the cards
  // arrive. Built-in discovery cards are already settled on first paint.
  const [settled, setSettled] = useState(showBuiltInCards);
  const [attempt, setAttempt] = useState(0);
  // Exam hubs link here as /cbt?mode=jamb; the filter opens on that exam rather
  // than asking the visitor to find it again in the pill row.
  const [activeFilter, setActiveFilter] = useState(() => simulatorExamType(initialFilter) ?? 'ALL');
  const changeFilter = (id: string) => {
    setActiveFilter(id);
    onFilterChange?.(id);
  };
  const phase = usePendingPhase(!settled && error === null);

  useEffect(() => {
    if (showBuiltInCards) return;
    let active = true;
    setError(null);
    setSettled(false);
    // The server catalogue is authoritative for both the bank and its question
    // availability. It works without exposing privileged bank reads to the
    // browser. The local preview has no published catalogue and says so.
    const request = isSupabaseConfigured
      ? fetchCbtExamsWithAvailability()
      : fetchCbtExams();
    void request
      .then((items) => {
        if (!active) return;
        setExams(items);
      })
      .catch((value) => active && setError(value))
      .finally(() => { if (active) setSettled(true); });
    return () => { active = false; };
  }, [attempt, showBuiltInCards]);

  const cards = useMemo<SimulatorCardModel[]>(
    () => showBuiltInCards ? [...(initialCards || [])] : buildSimulatorCards(exams),
    [showBuiltInCards, initialCards, exams],
  );
  const filters = useMemo(() => simulatorFilters(cards), [cards]);
  const visible = useMemo(() => filterSimulatorCards(cards, activeFilter), [cards, activeFilter]);

  if (!settled && error === null) {
    return (
      <div className="er-late-region er-late-region--simulators">
        <SkeletonTiles className="er-sim-grid" tiles={4} label="Loading CBT simulators" />
        {/* The skeleton keeps the layout; this names the wait once it is long
            enough to need a name, and replaces itself with a retry if the
            request never answers. */}
        {(phase === 'slow' || phase === 'stalled') && (
          <div className="er-slow-note">
            <WaveLoader variant="inline" decorative />
            <span>{phase === 'stalled' ? 'Still waiting for the CBT simulators.' : 'Connecting to the CBT simulators…'}</span>
            {phase === 'stalled' && (
              <button type="button" className="hub-outline-btn" onClick={() => setAttempt((value) => value + 1)}>
                Try again
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  if (error !== null) {
    return (
      <div className="er-late-region er-late-region--simulators">
        <ErrorState error={error} onRetry={() => setAttempt((value) => value + 1)} />
      </div>
    );
  }

  if (!cards.length) {
    return (
      <div className="er-late-region er-late-region--simulators">
        <div className="er-empty">{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div className="er-late-region er-late-region--simulators">
      {showFilters && filters.length > 2 && (
        <div className="er-sim-filters">
          <FilterPills
            options={filters}
            active={activeFilter}
            onChange={changeFilter}
            ariaLabel="Examination simulators"
          />
        </div>
      )}

      <div className="er-sim-grid">
        {visible.map((simulator) => (
          <SimulatorCard key={simulator.key} simulator={simulator} />
        ))}
      </div>

      {showFilters && visible.length === 0 && (
        <div className="er-empty">No simulator matches that examination yet. Choose another filter.</div>
      )}
    </div>
  );
}
