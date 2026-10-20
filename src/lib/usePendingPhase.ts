import { useEffect, useState } from 'react';

/**
 * UI-2 — how long a real request has been in flight, for disclosure only.
 *
 * Three things this deliberately does not do. It does not estimate network
 * speed: there is no throughput guess and no invented ETA. It does not create
 * a delay: a timer starts only because `pending` is already true, and it is
 * cleared the moment the request settles. And it does not keep waiting after
 * the request has failed — a failure is the caller's error state, not a
 * phase.
 *
 * `pending` is the first paint of an in-flight request, when a skeleton is
 * still the right answer. `slow` is the point at which the wait is worth
 * naming ("Loading questions…" instead of an anonymous shimmer). `stalled` is
 * the point at which an animation is no longer honest, so the screen offers a
 * retry rather than spinning forever.
 */
export type PendingPhase = 'idle' | 'pending' | 'slow' | 'stalled';

/** Long enough that most responses never show a named loader, short enough
 * that a student on a slow connection is not left guessing. */
export const SLOW_AFTER_MS = 1200;

/** A request this old is not "slow", it is stuck. */
export const STALLED_AFTER_MS = 20_000;

export function usePendingPhase(
  pending: boolean,
  {
    slowAfter = SLOW_AFTER_MS,
    stalledAfter = STALLED_AFTER_MS,
  }: { slowAfter?: number; stalledAfter?: number } = {},
): PendingPhase {
  const [phase, setPhase] = useState<PendingPhase>(pending ? 'pending' : 'idle');
  const [tracked, setTracked] = useState(pending);

  // Reset during render, not in an effect: a request that starts right after
  // one finished must never inherit the previous request's stall phase, even
  // for one frame.
  if (tracked !== pending) {
    setTracked(pending);
    setPhase(pending ? 'pending' : 'idle');
  }

  useEffect(() => {
    if (!pending) return;
    const slow = setTimeout(() => setPhase('slow'), slowAfter);
    const stalled = setTimeout(() => setPhase('stalled'), stalledAfter);
    return () => {
      clearTimeout(slow);
      clearTimeout(stalled);
    };
  }, [pending, slowAfter, stalledAfter]);

  return phase;
}
