/**
 * Isolated v2 answer-operation journal for local rehearsal.
 *
 * NOT connected to the CBT session. Browser persistence is a recovery aid,
 * not authoritative exam state. Do not enable the v2 page until its complete
 * lifecycle, conflict UI, account changes and cross-tab behavior are tested.
 */
import type { CbtQuestionPayload, CbtV2Outcome, CbtV2Snapshot } from './api';
import { CBT_UUID as UUID, validCbtV2Answer, validCbtV2Draft, validCbtV2QuestionIds, validCbtV2Revision as validRevision } from './cbtProtocolValidation';

export type QueueAnswer = number | null;
export type QueueStatus = 'pending' | 'acknowledged' | 'conflicted' | 'resolved-server' | 'superseded' | 'closed';
export type AnswerOperation = {
  accountId: string;
  attemptId: string;
  questionId: string;
  position: number;
  selected: QueueAnswer;
  baseAnswer: QueueAnswer;
  expectedRevision: number;
  operationKey: string;
  /** Monotonic browser-journal insertion order, not server authority. */
  sequence: number;
  createdAt: number;
  updatedAt: number;
  status: QueueStatus;
  lastServerAnswer: QueueAnswer;
  lastServerRevision: number;
  acceptedRevision: number | null;
};
export type QueueScope = { accountId: string; attemptId: string };
export type QueueTransport = {
  state: (attemptId: string) => Promise<CbtV2Snapshot>;
  answer: (attemptId: string, body: { expectedRevision: number; operationKey: string; questionId: string; selected: QueueAnswer }) => Promise<CbtV2Outcome>;
};
export type QueueLock = <T>(name: string, action: () => Promise<T>) => Promise<T>;

const validAnswer = (v: unknown): v is QueueAnswer => v === null || validCbtV2Answer(v);
const answerAt = (answers: Record<string, number>, position: number): QueueAnswer => answers[String(position)] ?? null;

/** Match a state already validated by fetchCbtV2State to the paper and journal. */
export function validateCbtJournalPaper(state: CbtV2Snapshot, paper: CbtQuestionPayload[], operations: AnswerOperation[]): void {
  const ids = state.questionIds;
  if (state.status !== 'in_progress' || !validCbtV2QuestionIds(ids) || !Array.isArray(paper) || paper.length !== ids.length ||
      paper.some((question, index) => !question || question.position !== index + 1 || typeof question.id !== 'string' ||
        question.id.toLowerCase() !== ids[index].toLowerCase() || typeof question.text !== 'string' || !question.text.trim() || typeof question.subject !== 'string' ||
        !Array.isArray(question.options) || !question.options.length || Array.from(question.options).some(option => typeof option !== 'string' || !option.trim()))) {
    throw new Error('CBT paper requires review.');
  }
  for (const op of operations) {
    const question = paper[op.position - 1];
    if (!question || question.id.toLowerCase() !== op.questionId.toLowerCase() ||
        [op.selected, op.baseAnswer, op.lastServerAnswer].some(value => value !== null && (value < 0 || value >= question.options.length))) {
      throw new Error('CBT journal requires review.');
    }
  }
  for (const [position, answer] of Object.entries(state.answers)) {
    const question = paper[Number(position) - 1];
    if (!question || answer >= question.options.length) throw new Error('CBT paper requires review.');
  }
}

function validateScope(scope: QueueScope) {
  if (!scope || typeof scope.accountId !== 'string' || typeof scope.attemptId !== 'string' || !UUID.test(scope.accountId) || !UUID.test(scope.attemptId)) throw new Error('Invalid CBT queue scope.');
}
function canonicalId(id: string): string {
  if (typeof id !== 'string' || !UUID.test(id)) throw new Error('Invalid CBT operation identity.');
  return id.toLowerCase();
}
function canonicalScope(scope: QueueScope): QueueScope {
  validateScope(scope);
  return { accountId: scope.accountId.toLowerCase(), attemptId: scope.attemptId.toLowerCase() };
}
function canonicalOperation(op: AnswerOperation): AnswerOperation {
  validateOperation(op, op);
  return { ...op, accountId: op.accountId.toLowerCase(), attemptId: op.attemptId.toLowerCase(), questionId: op.questionId.toLowerCase(), operationKey: op.operationKey.toLowerCase() };
}
function validateOperation(op: AnswerOperation, scope: QueueScope) {
  validateScope(scope);
  if (!op || op.accountId !== scope.accountId || op.attemptId !== scope.attemptId || typeof op.questionId !== 'string' || !UUID.test(op.questionId) ||
      typeof op.operationKey !== 'string' || !UUID.test(op.operationKey) || !Number.isSafeInteger(op.position) || op.position < 1 ||
      !validAnswer(op.selected) || !validAnswer(op.baseAnswer) || !validAnswer(op.lastServerAnswer) ||
      !validRevision(op.expectedRevision) || !validRevision(op.lastServerRevision) || !validRevision(op.sequence) ||
      !(op.acceptedRevision === null || validRevision(op.acceptedRevision)) ||
      !Number.isSafeInteger(op.createdAt) || !Number.isSafeInteger(op.updatedAt) ||
      !['pending', 'acknowledged', 'conflicted', 'resolved-server', 'superseded', 'closed'].includes(op.status)) {
    throw new Error('CBT queue requires review.');
  }
}
function validateSnapshot(snapshot: Omit<CbtV2Snapshot, 'questionIds'>) {
  if (snapshot.protocol !== 2 || !validRevision(snapshot.revision) || snapshot.status !== 'in_progress' || !validCbtV2Draft(snapshot.answers)) {
    throw new Error('CBT server state requires review.');
  }
}

/** Read-only projection. Unknown or conflicting histories require review, never inference. */
export function projectCbtJournal(scope: QueueScope, state: CbtV2Snapshot, paper: CbtQuestionPayload[], operations: AnswerOperation[]): Record<number, number> {
  scope = canonicalScope(scope);
  validateSnapshot(state);
  const rows = operations.map(canonicalOperation);
  validateCbtJournalPaper(state, paper, rows);
  const projected: Record<number, number> = { ...state.answers };
  const keys = new Set<string>();
  let sequence = 0;
  for (const op of rows) {
    validateOperation(op, scope);
    if (op.sequence <= sequence || keys.has(op.operationKey)) throw new Error('CBT journal requires review.');
    sequence = op.sequence; keys.add(op.operationKey);
    const server = answerAt(state.answers, op.position);
    if (op.status === 'conflicted' || op.status === 'closed') throw new Error('CBT journal requires review.');
    if (op.status === 'pending') {
      // A stale/unknown request may have committed or been superseded remotely.
      if (op.acceptedRevision !== null || op.expectedRevision !== state.revision || op.lastServerRevision !== op.expectedRevision ||
          op.baseAnswer !== server || op.lastServerAnswer !== op.baseAnswer) throw new Error('CBT journal requires review.');
      if (op.selected === null) delete projected[op.position]; else projected[op.position] = op.selected;
    } else if (op.status === 'acknowledged') {
      if (op.acceptedRevision !== op.expectedRevision + 1 || op.lastServerRevision < op.acceptedRevision ||
          op.lastServerRevision > state.revision || op.lastServerAnswer !== op.selected ||
          (op.lastServerRevision === state.revision && server !== op.selected)) throw new Error('CBT journal requires review.');
      // The current server snapshot wins over historical acknowledgements.
    } else if (op.lastServerRevision > state.revision) throw new Error('CBT journal requires review.');
  }
  return projected;
}

/** Atomic persistence interface; implementations must commit before resolving. */
export interface AnswerJournal {
  add(op: AnswerOperation): Promise<AnswerOperation>;
  list(scope: QueueScope): Promise<AnswerOperation[]>;
  transition(scope: QueueScope, key: string, expected: QueueStatus, next: AnswerOperation): Promise<boolean>;
  replaceConflict(scope: QueueScope, key: string, next: AnswerOperation, replacement: AnswerOperation): Promise<AnswerOperation | null>;
}

/**
 * Separate journal rows prevent snapshot clobbering between tabs. IDB write
 * transactions atomically replace a conflict with its new logical operation.
 * This class deliberately never deletes or compacts rows.
 */
const JOURNAL_NAME = 'edureach-cbt-v2-operations';
function openJournal(factory: IDBFactory, name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let blocked = false;
    const request = factory.open(name, 2);
    request.onupgradeneeded = event => {
      if (blocked) { request.transaction!.abort(); return; }
      const db = request.result;
      if (event.oldVersion === 0) {
        const store = db.createObjectStore('operations', { keyPath: 'operationKey' });
        store.createIndex('scope', ['accountId', 'attemptId']);
        db.createObjectStore('metadata');
        return;
      }
      // Versionchange is one atomic transaction. Abort rather than guess if
      // two case variants differ, the counter is corrupt, or any row is bad.
      const tx = request.transaction!;
      const store = tx.objectStore('operations');
      const all = store.getAll();
      all.onsuccess = () => {
        try {
          const unique = new Map<string, AnswerOperation>();
          const sequences = new Set<number>();
          let maxSequence = 0;
          for (const raw of all.result as AnswerOperation[]) {
            const op = canonicalOperation(raw);
            if (op.sequence < 1) throw new Error('Invalid sequence');
            const previous = unique.get(op.operationKey);
            if (previous) {
              const a = previous as unknown as Record<string, unknown>, b = op as unknown as Record<string, unknown>;
              const keys = Object.keys(a);
              if (keys.length !== Object.keys(b).length || keys.some(key =>
                !Object.hasOwn(b, key) || (a[key] !== null && typeof a[key] === 'object') || !Object.is(a[key], b[key]))) throw new Error('Operation identity collision');
              continue;
            }
            if (sequences.has(op.sequence)) throw new Error('Sequence collision');
            sequences.add(op.sequence); maxSequence = Math.max(maxSequence, op.sequence); unique.set(op.operationKey, op);
          }
          const counter = tx.objectStore('metadata').get('sequence');
          counter.onsuccess = () => {
            if (unique.size && (!Number.isSafeInteger(counter.result) || counter.result < maxSequence)) { tx.abort(); return; }
            store.clear();
            unique.forEach(op => store.add(op));
          };
        } catch { tx.abort(); }
      };
    };
    request.onerror = () => reject(request.error ?? new Error('CBT storage unavailable.'));
    request.onblocked = () => { blocked = true; reject(new Error('CBT storage unavailable.')); };
    request.onsuccess = () => {
      if (blocked) { request.result.close(); return; }
      request.result.onversionchange = () => request.result.close(); resolve(request.result);
    };
  });
}

async function listJournal(db: IDBDatabase, scope: QueueScope): Promise<AnswerOperation[]> {
  scope = canonicalScope(scope);
  const rows = await new Promise<AnswerOperation[]>((resolve, reject) => {
    const tx = db.transaction('operations', 'readonly');
    const request = tx.objectStore('operations').index('scope').getAll([scope.accountId, scope.attemptId]);
    request.onsuccess = () => resolve(request.result as AnswerOperation[]);
    request.onerror = () => reject(request.error ?? new Error('CBT storage unavailable.'));
    tx.onabort = () => reject(tx.error ?? new Error('CBT storage unavailable.'));
  });
  rows.forEach(row => { validateOperation(row, scope); if (row.sequence < 1) throw new Error('CBT queue requires review.'); });
  return rows.sort((a, b) => a.sequence - b.sequence);
}

/** Read-only preflight using the exact same opener and validation as the queue. */
export async function inspectCbtAnswerJournal(scope: QueueScope): Promise<AnswerOperation[]> {
  const db = await openJournal(indexedDB, JOURNAL_NAME);
  try { return await listJournal(db, scope); } finally { db.close(); }
}

export class IndexedDbAnswerJournal implements AnswerJournal {
  private db: Promise<IDBDatabase>;
  constructor(factory: IDBFactory = indexedDB, name = JOURNAL_NAME) {
    this.db = openJournal(factory, name);
  }
  async add(op: AnswerOperation): Promise<AnswerOperation> {
    op = canonicalOperation(op);
    const db = await this.db;
    return new Promise<AnswerOperation>((resolve, reject) => {
      const tx = db.transaction(['operations', 'metadata'], 'readwrite');
      const meta = tx.objectStore('metadata');
      const counter = meta.get('sequence');
      let saved = op;
      counter.onsuccess = () => {
        const sequence = (counter.result ?? 0) + 1;
        if (!Number.isSafeInteger(sequence)) { tx.abort(); return; }
        saved = { ...op, sequence };
        meta.put(sequence, 'sequence');
        tx.objectStore('operations').add(saved);
      };
      tx.oncomplete = () => resolve(saved);
      tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('CBT storage unavailable.'));
    });
  }
  async list(scope: QueueScope): Promise<AnswerOperation[]> {
    return listJournal(await this.db, scope);
  }
  async transition(scope: QueueScope, key: string, expected: QueueStatus, next: AnswerOperation): Promise<boolean> {
    return (await this.mutate(scope, key, expected, next)) !== null;
  }
  async replaceConflict(scope: QueueScope, key: string, next: AnswerOperation, replacement: AnswerOperation): Promise<AnswerOperation | null> {
    scope = canonicalScope(scope); key = canonicalId(key);
    next = canonicalOperation(next); replacement = canonicalOperation(replacement);
    validateOperation(replacement, scope);
    if (next.status !== 'superseded' || replacement.status !== 'pending' || replacement.operationKey === key ||
        replacement.questionId !== next.questionId || replacement.position !== next.position || replacement.selected !== next.selected) {
      throw new Error('Invalid CBT conflict resolution.');
    }
    return this.mutate(scope, key, 'conflicted', next, replacement);
  }
  private async mutate(scope: QueueScope, key: string, expected: QueueStatus, next: AnswerOperation, replacement?: AnswerOperation): Promise<AnswerOperation | null> {
    scope = canonicalScope(scope); key = canonicalId(key); next = canonicalOperation(next);
    validateOperation(next, scope);
    if (next.operationKey !== key) throw new Error('Invalid CBT operation identity.');
    const db = await this.db;
    return new Promise<AnswerOperation | null>((resolve, reject) => {
      let saved: AnswerOperation | null = null;
      const tx = db.transaction(['operations', 'metadata'], 'readwrite');
      const store = tx.objectStore('operations');
      const request = store.get(key);
      request.onsuccess = () => {
        const current = request.result as AnswerOperation | undefined;
        if (!current || current.accountId !== scope.accountId || current.attemptId !== scope.attemptId || current.status !== expected) return;
        // Frozen request fields can never be modified under the same key.
        if (current.questionId !== next.questionId || current.position !== next.position || current.selected !== next.selected ||
            current.baseAnswer !== next.baseAnswer || current.expectedRevision !== next.expectedRevision ||
            current.createdAt !== next.createdAt || current.sequence !== next.sequence) {
          tx.abort(); return;
        }
        store.put(next);
        if (!replacement) { saved = next; return; }
        const meta = tx.objectStore('metadata');
        const counter = meta.get('sequence');
        counter.onsuccess = () => {
          const sequence = (counter.result ?? 0) + 1;
          if (!Number.isSafeInteger(sequence)) { tx.abort(); return; }
          saved = { ...replacement, sequence };
          meta.put(sequence, 'sequence');
          store.add(saved);
        };
      };
      tx.oncomplete = () => resolve(saved);
      tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('CBT storage transaction failed.'));
    });
  }
  async close(): Promise<void> { (await this.db).close(); }
}

/** A missing Web Locks implementation must disable sending, not race a lease. */
export const browserQueueLock: QueueLock = async (name, action) => {
  if (typeof navigator === 'undefined' || !navigator.locks) throw new Error('CBT cross-tab coordination is unavailable.');
  return navigator.locks.request(name, { mode: 'exclusive' }, action);
};

export class CbtAnswerQueue {
  constructor(
    private readonly scope: QueueScope,
    private readonly journal: AnswerJournal,
    private readonly transport: QueueTransport,
    private readonly lock: QueueLock = browserQueueLock,
    private readonly makeId: () => string = () => crypto.randomUUID(),
    private readonly now: () => number = () => Date.now(),
  ) { this.scope = canonicalScope(scope); }

  list(): Promise<AnswerOperation[]> { return this.journal.list(this.scope); }

  /** Persist a new immutable logical mutation before it can be transmitted. */
  async enqueue(questionId: string, position: number, selected: QueueAnswer, baseAnswer: QueueAnswer, revision: number): Promise<AnswerOperation> {
    const now = this.now();
    const op: AnswerOperation = canonicalOperation({ ...this.scope, questionId, position, selected, baseAnswer, expectedRevision: revision,
      operationKey: this.makeId(), sequence: 0, createdAt: now, updatedAt: now, status: 'pending', lastServerAnswer: baseAnswer,
      lastServerRevision: revision, acceptedRevision: null });
    validateOperation(op, this.scope);
    return this.journal.add(op);
  }

  /** Retrying an uncertain response resends the exact persisted request. */
  async retry(key: string): Promise<AnswerOperation> {
    key = canonicalId(key);
    return this.lock(`edureach-cbt:${this.scope.accountId}:${this.scope.attemptId}`, async () => {
      const operations = await this.list();
      const op = operations.find(row => row.operationKey === key);
      if (!op) throw new Error('CBT operation not found.');
      if (op.status !== 'pending') return op;
      // A later local choice must not leapfrog an earlier uncertain write or
      // an unresolved conflict on the same question. Other questions remain
      // independent; the server's attempt revision is still authoritative.
      const earlier = operations.find(row => row.sequence < op.sequence && row.questionId.toLowerCase() === op.questionId.toLowerCase() &&
        (row.status === 'pending' || row.status === 'conflicted'));
      if (earlier) throw new Error(`An earlier CBT ${earlier.status === 'conflicted' ? 'conflict' : 'pending operation'} requires attention.`);
      const response = await this.transport.answer(op.attemptId, {
        expectedRevision: op.expectedRevision, operationKey: op.operationKey, questionId: op.questionId, selected: op.selected,
      });
      let next: AnswerOperation;
      if (response.outcome === 'accepted' || response.outcome === 'replayed') {
        if (!validRevision(response.revision) || response.acceptedRevision !== op.expectedRevision + 1 ||
            response.revision < response.acceptedRevision || !response.answers || response.status !== 'in_progress') {
          throw new Error('CBT acknowledgement requires review.');
        }
        const snapshot = { protocol: 2 as const, revision: response.revision, answers: response.answers, status: response.status };
        validateSnapshot(snapshot);
        const serverAnswer = answerAt(snapshot.answers, op.position);
        next = { ...op, status: serverAnswer === op.selected ? 'acknowledged' : 'conflicted', updatedAt: this.now(),
          lastServerAnswer: serverAnswer, lastServerRevision: snapshot.revision, acceptedRevision: response.acceptedRevision };
      } else if (response.outcome === 'conflict') {
        if (!validRevision(response.revision) || !response.answers || response.status !== 'in_progress') throw new Error('CBT conflict requires review.');
        const reported = { protocol: 2 as const, revision: response.revision, answers: response.answers, status: response.status };
        validateSnapshot(reported);
        // Persist the conflict before fetching: a lost state response must not
        // turn a consumed conflict key back into an apparently new operation.
        next = { ...op, status: 'conflicted', updatedAt: this.now(), lastServerAnswer: answerAt(reported.answers, op.position), lastServerRevision: reported.revision };
        if (!await this.journal.transition(this.scope, key, 'pending', next)) throw new Error('CBT operation changed in another tab.');
        const current = await this.transport.state(op.attemptId);
        validateSnapshot(current);
        if (current.revision < next.lastServerRevision) throw new Error('CBT server revision went backwards.');
        const refreshed = { ...next, lastServerAnswer: answerAt(current.answers, op.position), lastServerRevision: current.revision, updatedAt: this.now() };
        if (!await this.journal.transition(this.scope, key, 'conflicted', refreshed)) throw new Error('CBT operation changed in another tab.');
        return refreshed;
      } else if (response.outcome === 'expired' || response.outcome === 'closed') {
        next = { ...op, status: 'closed', updatedAt: this.now() };
      } else throw new Error('Unexpected CBT answer response.');
      if (!await this.journal.transition(this.scope, key, 'pending', next)) throw new Error('CBT operation changed in another tab.');
      return next;
    });
  }

  /** The caller must present the same server version/answer the student saw. */
  async resolve(key: string, choice: 'server' | 'local', reviewedRevision: number, reviewedServerAnswer: QueueAnswer): Promise<AnswerOperation> {
    key = canonicalId(key);
    return this.lock(`edureach-cbt:${this.scope.accountId}:${this.scope.attemptId}`, async () => {
      const op = (await this.list()).find(row => row.operationKey === key);
      if (!op || op.status !== 'conflicted') throw new Error('CBT conflict no longer available.');
      const state = await this.transport.state(op.attemptId);
      validateSnapshot(state);
      if (state.revision < op.lastServerRevision) throw new Error('CBT server revision went backwards.');
      const serverAnswer = answerAt(state.answers, op.position);
      if (reviewedRevision !== op.lastServerRevision || reviewedServerAnswer !== op.lastServerAnswer ||
          state.revision !== reviewedRevision || serverAnswer !== reviewedServerAnswer) {
        const updated = { ...op, lastServerAnswer: serverAnswer, lastServerRevision: state.revision, updatedAt: this.now() };
        if (!await this.journal.transition(this.scope, key, 'conflicted', updated)) throw new Error('CBT conflict changed in another tab.');
        throw new Error('CBT server state changed; review the conflict again.');
      }
      if (choice === 'server') {
        const resolved: AnswerOperation = { ...op, status: 'resolved-server', updatedAt: this.now() };
        if (!await this.journal.transition(this.scope, key, 'conflicted', resolved)) throw new Error('CBT conflict changed in another tab.');
        return resolved;
      }
      if (choice !== 'local') throw new Error('Invalid CBT conflict choice.');
      const now = this.now();
      const replacement: AnswerOperation = { ...this.scope, questionId: op.questionId, position: op.position, selected: op.selected,
        baseAnswer: serverAnswer, expectedRevision: state.revision, operationKey: this.makeId(), sequence: 0, createdAt: now, updatedAt: now,
        status: 'pending', lastServerAnswer: serverAnswer, lastServerRevision: state.revision, acceptedRevision: null };
      const superseded: AnswerOperation = { ...op, status: 'superseded', updatedAt: now };
      const saved = await this.journal.replaceConflict(this.scope, key, superseded, replacement);
      if (!saved) throw new Error('CBT conflict changed in another tab.');
      return saved;
    });
  }
}

/**
 * Isolated recovery coordinator. It retries existing identities only; callers
 * must explicitly supply a scope, a frozen paper and an identity guard.
 * Not wired to the CBT page or any hosted environment.
 */
export async function recoverCbtJournal({ scope, paper, journal, transport, lock = browserQueueLock, assertCurrent }: {
  scope: QueueScope;
  paper: CbtQuestionPayload[];
  journal: AnswerJournal;
  transport: QueueTransport;
  lock?: QueueLock;
  assertCurrent: () => void;
}): Promise<{ state: CbtV2Snapshot; operations: AnswerOperation[]; answers: Record<number, number> }> {
  scope = canonicalScope(scope);
  return lock(`edureach-cbt-recovery:${scope.accountId}:${scope.attemptId}`, async () => {
    assertCurrent();
    const initial = await transport.state(scope.attemptId);
    assertCurrent();
    validateSnapshot(initial);
    validateCbtJournalPaper(initial, paper, []);
    const originalIds = initial.questionIds;
    const checkedTransport: QueueTransport = {
      state: async attempt => {
        assertCurrent(); const state = await transport.state(attempt); assertCurrent();
        validateSnapshot(state); validateCbtJournalPaper(state, paper, []); return state;
      },
      answer: async (attempt, body) => {
        assertCurrent(); const response = await transport.answer(attempt, body); assertCurrent();
        if (response.outcome === 'accepted' || response.outcome === 'replayed' || response.outcome === 'conflict') {
          const snapshot = { protocol: 2 as const, revision: response.revision, answers: response.answers, status: response.status, questionIds: originalIds };
          if (typeof snapshot.revision !== 'number' || !snapshot.answers || typeof snapshot.status !== 'string') throw new Error('CBT server state requires review.');
          const checked = snapshot as CbtV2Snapshot;
          validateSnapshot(checked); validateCbtJournalPaper(checked, paper, []);
        }
        return response;
      },
    };
    const queue = new CbtAnswerQueue(scope, journal, checkedTransport, lock);
    const rows = await queue.list(); assertCurrent();
    validateCbtJournalPaper(initial, paper, rows);
    // Validate all rows and ordering before *any* write; stale pending rows
    // may be retries of already-committed operations, so do not project yet.
    const seen = new Set<string>(); let sequence = 0;
    for (const row of rows) {
      const op = canonicalOperation(row); validateOperation(op, scope);
      if (op.sequence <= sequence || seen.has(op.operationKey)) throw new Error('CBT journal requires review.');
      sequence = op.sequence; seen.add(op.operationKey);
      if (op.status === 'conflicted' || op.status === 'closed') throw new Error('CBT conflict or closed operation requires review.');
      if (op.status === 'pending' && (op.expectedRevision > initial.revision || op.acceptedRevision !== null ||
          op.lastServerRevision !== op.expectedRevision || op.lastServerAnswer !== op.baseAnswer ||
          (op.expectedRevision === initial.revision && answerAt(initial.answers, op.position) !== op.baseAnswer))) {
        throw new Error('CBT pending operation requires review.');
      }
    }
    projectCbtJournal(scope, initial, paper, rows.filter(row => row.status !== 'pending'));
    for (const row of rows) if (row.status === 'pending') {
      assertCurrent(); const result = await queue.retry(row.operationKey); assertCurrent();
      if (result.status !== 'acknowledged') throw new Error(`CBT ${result.status} operation requires review.`);
    }
    const state = await checkedTransport.state(scope.attemptId); assertCurrent();
    if (state.revision < initial.revision) throw new Error('CBT server revision went backwards.');
    const operations = await queue.list(); assertCurrent();
    if (operations.some(op => op.status === 'pending')) throw new Error('CBT pending operation requires review.');
    const answers = projectCbtJournal(scope, state, paper, operations);
    return { state, operations, answers };
  });
}
