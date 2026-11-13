/**
 * Pure reconciliation of a known base, local intent and authoritative server
 * draft. This does not save anything: every proposal still needs a fresh
 * revision, a new operation key and a confirmed server acknowledgement.
 *
 * When the base is unavailable, no difference is considered safe to replay.
 * This module is not yet wired to the CBT session or candidate protocol.
 */
export type CbtDraft = Record<string, number>;
export type CbtSelection = number | null;
export type CbtDifference = {
  position: string;
  base: CbtSelection;
  local: CbtSelection;
  server: CbtSelection;
};
export type CbtReconciliation = {
  /** Candidate local edits only; these are not saved and have not been sent. */
  proposals: CbtDifference[];
  /** Explicit student review is required before selecting either value. */
  conflicts: CbtDifference[];
  /** Without a base, every mismatch requires review rather than inference. */
  baseKnown: boolean;
};

function validate(draft: CbtDraft): void {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) throw new Error('Invalid CBT draft');
  for (const [position, selected] of Object.entries(draft)) {
    if (!/^[1-9]\d*$/.test(position) || !Number.isSafeInteger(Number(position)) ||
        !Number.isInteger(selected) || selected < 0 || selected > 3) {
      throw new Error('Invalid CBT draft');
    }
  }
}

/** Compare full snapshots, including deliberate clears, without mutating them. */
export function compareCbtDrafts(base: CbtDraft | null, local: CbtDraft, server: CbtDraft): CbtReconciliation {
  if (base !== null) validate(base);
  validate(local);
  validate(server);
  const positions = new Set([...Object.keys(base ?? {}), ...Object.keys(local), ...Object.keys(server)]);
  const proposals: CbtDifference[] = [];
  const conflicts: CbtDifference[] = [];
  for (const position of [...positions].sort((a, b) => Number(a) - Number(b))) {
    const b = base?.[position] ?? null;
    const l = local[position] ?? null;
    const s = server[position] ?? null;
    if (l === s) continue;
    const difference = { position, base: b, local: l, server: s };
    if (base === null) conflicts.push(difference);
    else if (l === b) continue; // only the server changed; retain its accepted value
    else if (s === b) proposals.push(difference); // local-only intent, still unsaved
    else conflicts.push(difference);
  }
  return { proposals, conflicts, baseKnown: base !== null };
}
