/**
 * The CBT recovery journal: one IndexedDB record per account and attempt.
 *
 * Everything the hall needs to come back from a dead network, a closed tab, a
 * refresh or an expired session is written here BEFORE any network sync: the
 * frozen paper, the current question, the answers, and the operations not yet
 * confirmed by the server. It is scoped to `accountId:attemptId` (lower-cased)
 * so one account's attempt data can never surface under another account on the
 * same device.
 *
 * This is user data in a user-scoped store — never a shared service-worker
 * cache. If IndexedDB is unavailable the hall falls back to its localStorage
 * pending copy and keeps working; the journal is best-effort durability, not a
 * gate.
 */

export type CbtRecoveryDraft = Record<number, number>;

/**
 * The frozen paper exactly as the hall received it. Stored opaque on purpose:
 * the journal preserves what the page already validated; it re-validates
 * nothing and infers nothing.
 */
export type CbtRecoveryPaper = {
  attempt: unknown;
  questions: unknown[];
};

export type CbtRecoveryRecord = {
  /** `${accountId}:${attemptId}`, lower-cased. */
  key: string;
  accountId: string;
  attemptId: string;
  /** The frozen paper, so a resume can render before any network answers. */
  paper: CbtRecoveryPaper | null;
  currentIndex: number;
  /** The device's answer intent — including deliberate clears (absent keys). */
  answers: CbtRecoveryDraft;
  flags: Record<number, boolean>;
  /** The last draft the SERVER acknowledged: the reconciliation base. */
  confirmedAnswers: CbtRecoveryDraft | null;
  /** A save the server has not acknowledged yet. */
  pendingDraft: { answers: CbtRecoveryDraft; questionIndex: number; savedAt: number } | null;
  /** A submission started but not yet confirmed. */
  pendingSubmission: boolean;
  /** Bumped on every write; a stale tab's write must not lower it silently. */
  revision: number;
  updatedAt: number;
};

const DB_NAME = 'edureach-cbt-recovery-journal';
const STORE = 'attempts';
const DB_VERSION = 1;

export function recoveryJournalKey(accountId: string, attemptId: string): string {
  return `${accountId.trim().toLowerCase()}:${attemptId.trim().toLowerCase()}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'key' });
        store.createIndex('accountId', 'accountId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
    request.onblocked = () => reject(new Error('IndexedDB open blocked'));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function validDraft(value: unknown): CbtRecoveryDraft {
  const out: CbtRecoveryDraft = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  for (const [position, selected] of Object.entries(value as Record<string, unknown>)) {
    if (!/^[1-9]\d*$/.test(position)) continue;
    if (!Number.isInteger(selected) || (selected as number) < 0 || (selected as number) > 3) continue;
    out[Number(position)] = selected as number;
  }
  return out;
}

/** Parse and validate a stored record; a corrupt record reads as "none". */
function sanitize(raw: unknown): CbtRecoveryRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Partial<CbtRecoveryRecord>;
  if (typeof row.key !== 'string' || typeof row.accountId !== 'string' || typeof row.attemptId !== 'string') return null;
  if (row.key !== recoveryJournalKey(row.accountId, row.attemptId)) return null;
  return {
    key: row.key,
    accountId: row.accountId.toLowerCase(),
    attemptId: row.attemptId.toLowerCase(),
    paper:
      row.paper && typeof row.paper === 'object' && Array.isArray((row.paper as { questions?: unknown[] }).questions)
        ? (row.paper as CbtRecoveryPaper)
        : null,
    currentIndex: Number.isInteger(row.currentIndex) ? Math.max(0, row.currentIndex as number) : 0,
    answers: validDraft(row.answers),
    flags: row.flags && typeof row.flags === 'object' && !Array.isArray(row.flags) ? (row.flags as Record<number, boolean>) : {},
    confirmedAnswers: row.confirmedAnswers === null || row.confirmedAnswers === undefined ? null : validDraft(row.confirmedAnswers),
    pendingDraft:
      row.pendingDraft && typeof row.pendingDraft === 'object'
        ? {
            answers: validDraft((row.pendingDraft as { answers?: unknown }).answers),
            questionIndex: Number.isInteger((row.pendingDraft as { questionIndex?: unknown }).questionIndex)
              ? ((row.pendingDraft as { questionIndex?: number }).questionIndex ?? 0)
              : 0,
            savedAt: Number.isFinite((row.pendingDraft as { savedAt?: unknown }).savedAt)
              ? ((row.pendingDraft as { savedAt?: number }).savedAt ?? 0)
              : 0,
          }
        : null,
    pendingSubmission: row.pendingSubmission === true,
    revision: Number.isInteger(row.revision) ? (row.revision as number) : 0,
    updatedAt: Number.isFinite(row.updatedAt) ? (row.updatedAt as number) : 0,
  };
}

/**
 * Merge a patch into the journal record. The write is refused (and the current
 * record returned) when the stored revision has moved past the revision the
 * patch was based on — a stale tab cannot silently overwrite a newer record.
 */
export async function writeCbtRecoveryJournal(
  base: { accountId: string; attemptId: string; revision: number },
  patch: Partial<Omit<CbtRecoveryRecord, 'key' | 'accountId' | 'attemptId'>>,
): Promise<CbtRecoveryRecord | null> {
  const db = await openDb();
  try {
    const key = recoveryJournalKey(base.accountId, base.attemptId);
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const current = sanitize(await requestToPromise(store.get(key)));
    if (current && current.revision > base.revision) return current; // refused: newer write exists
    const merged: CbtRecoveryRecord = sanitize({
      ...(current ?? {
        key,
        accountId: base.accountId,
        attemptId: base.attemptId,
        paper: null,
        currentIndex: 0,
        answers: {},
        flags: {},
        confirmedAnswers: null,
        pendingDraft: null,
        pendingSubmission: false,
        revision: 0,
        updatedAt: 0,
      }),
      ...patch,
      key,
      accountId: base.accountId.toLowerCase(),
      attemptId: base.attemptId.toLowerCase(),
      revision: (current?.revision ?? 0) + 1,
      updatedAt: Date.now(),
    })!;
    await requestToPromise(store.put(merged));
    return merged;
  } finally {
    db.close();
  }
}

export async function readCbtRecoveryJournal(accountId: string, attemptId: string): Promise<CbtRecoveryRecord | null> {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE, 'readonly');
      return sanitize(await requestToPromise(tx.objectStore(STORE).get(recoveryJournalKey(accountId, attemptId))));
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

/** Removed only once the server has confirmed what replaced it. */
export async function clearCbtRecoveryJournal(accountId: string, attemptId: string): Promise<void> {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE, 'readwrite');
      await requestToPromise(tx.objectStore(STORE).delete(recoveryJournalKey(accountId, attemptId)));
    } finally {
      db.close();
    }
  } catch {
    // Best-effort durability: an unreachable store must not block the student.
  }
}

/** Every record on this device, for tests and recovery inspection. */
export async function inspectCbtRecoveryJournal(): Promise<CbtRecoveryRecord[]> {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE, 'readonly');
      const rows = await requestToPromise(tx.objectStore(STORE).getAll());
      return (rows as unknown[]).map(sanitize).filter((row): row is CbtRecoveryRecord => row !== null);
    } finally {
      db.close();
    }
  } catch {
    return [];
  }
}
