/**
 * CBT countdown — deadline-derived timing, shared by the exam hall and the
 * server.
 *
 * Three rules this module exists to enforce:
 *
 *   1. The server's `expiresAt` is the only authority for remaining time. A
 *      client-side duration is never subtracted from; every displayed value is
 *      recomputed from the deadline, so a refresh, a suspended tab or device
 *      sleep cannot reset or freeze the clock.
 *   2. The device clock is only used to measure elapsed time, offset against
 *      the server clock captured from a response. A device with the wrong time
 *      cannot shorten or extend the examination.
 *   3. An attempt with no deadline is untimed — it says so honestly instead of
 *      rendering a frozen "00:00", and it never auto-submits.
 */

/** Attempts whose remaining time is measured from this deadline. */
export interface CbtDeadlineAttempt {
  expires_at?: string | null;
  started_at?: string | null;
  duration_minutes?: number | null;
}

function parseIsoMs(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * The authoritative deadline in ISO form, resolved server-side from stored
 * columns only.
 *
 * `expires_at` is the deadline when present. A legacy row created without one
 * (an insert where `duration_minutes` was null produced `started_at + null`
 * interval) is still a timed attempt whenever its duration is known: the
 * deadline is `started_at + duration_minutes`, which is exactly what the setup
 * wizard promised. A row with neither is genuinely untimed and gets `null` —
 * never a client-computed substitute.
 */
export function effectiveCbtDeadlineIso(attempt: CbtDeadlineAttempt): string | null {
  const expires = parseIsoMs(attempt.expires_at);
  if (expires !== null) return new Date(expires).toISOString();
  const started = parseIsoMs(attempt.started_at);
  const minutes = Number(attempt.duration_minutes);
  if (started === null || !Number.isFinite(minutes) || minutes <= 0) return null;
  return new Date(started + minutes * 60_000).toISOString();
}

/**
 * Offset from the device clock to the server clock (`serverNow = deviceNow +
 * offset`), derived from the server time in a response. Returns null when the
 * value cannot be trusted, so callers keep their previous offset instead of
 * latching a NaN.
 */
export function serverOffsetMsFrom(serverTimeIso: string | null | undefined, deviceNowMs: number): number | null {
  const serverMs = parseIsoMs(serverTimeIso);
  if (serverMs === null || !Number.isFinite(deviceNowMs)) return null;
  return serverMs - deviceNowMs;
}

export interface CbtCountdownView {
  /** False when the server gave no deadline: an untimed session. */
  timed: boolean;
  /** The server deadline as epoch ms, or null when untimed. */
  deadlineMs: number | null;
  /** Seconds left at `deviceNowMs`, or null when untimed. Never NaN. */
  remainingSeconds: number | null;
  /** The planned length in seconds, for the progress track. */
  totalSeconds: number;
  timeAlmostUp: boolean;
  progressPercent: number;
}

/**
 * The countdown view-model at one instant.
 *
 * Everything is recomputed from the deadline and the current time — there is
 * no counter to decrement, so backgrounding, sleep and refresh are correct by
 * construction and the next tick after a resume is already exact.
 */
export function computeCbtCountdown(input: {
  expiresAt: string | null | undefined;
  durationMinutes: number | null | undefined;
  serverOffsetMs: number | null | undefined;
  deviceNowMs: number;
}): CbtCountdownView {
  const deadlineMs = parseIsoMs(input.expiresAt);
  const offset = Number.isFinite(input.serverOffsetMs) ? Number(input.serverOffsetMs) : 0;
  const minutes = Number(input.durationMinutes);
  const plannedSeconds = Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60) : 0;
  if (deadlineMs === null) {
    return {
      timed: false,
      deadlineMs: null,
      remainingSeconds: null,
      totalSeconds: plannedSeconds,
      timeAlmostUp: false,
      progressPercent: 0,
    };
  }
  const serverNowMs = Number.isFinite(input.deviceNowMs) ? input.deviceNowMs + offset : deadlineMs;
  const remainingSeconds = Math.max(0, Math.floor((deadlineMs - serverNowMs) / 1000));
  const totalSeconds = Math.max(plannedSeconds, remainingSeconds);
  return {
    timed: true,
    deadlineMs,
    remainingSeconds,
    totalSeconds,
    timeAlmostUp: remainingSeconds <= 300,
    progressPercent: totalSeconds > 0 ? Math.min(100, Math.round(((totalSeconds - remainingSeconds) / totalSeconds) * 100)) : 0,
  };
}

/** `1:05:03` or `05:03`, clamped at zero and NaN-safe. */
export function formatClock(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}
