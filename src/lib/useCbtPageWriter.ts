import { useEffect, useRef, useState } from 'react';
import { fetchCbtV2State, openCbtV2WritingSession, sendCbtV2Operation, type CbtQuestionPayload, type CbtV2Snapshot } from './api';
import { CbtAnswerQueue, CbtWritingSessionRevokedError, IndexedDbAnswerJournal, projectCbtJournal, validateCbtJournalPaper, type AnswerOperation, type CbtWritingSessionRequest, type QueueAnswer, type QueueTransport } from './cbtAnswerQueue';
import { CBT_UUID } from './cbtProtocolValidation';

type Lease = { sessionId: string; sessionGeneration: number };
type Phase = 'loading' | 'active' | 'takeover' | 'revoked' | 'expired' | 'error';
type View = { phase: Phase; answers: Record<number, number>; rows: AnswerOperation[]; busy: boolean; message: string; hasSnapshot: boolean };
const initial: View = { phase: 'loading', answers: {}, rows: [], busy: false, message: '', hasSnapshot: false };
type Controller = { choose: (question: CbtQuestionPayload, selected: QueueAnswer) => Promise<void>; takeover: () => Promise<void>; retry: () => Promise<void>; review: (key: string) => Promise<void>; resolve: (row: AnswerOperation, choice: 'local' | 'server') => Promise<void> };

/** Page orchestration only: all durable operations remain in the existing journal. */
export function useCbtPageWriter(accountId: string | undefined, attemptId: string, paper: CbtQuestionPayload[] | null) {
  const [view, setView] = useState<View>(initial);
  const controller = useRef<Controller | null>(null);
  const account = useRef(accountId); account.current = accountId;
  useEffect(() => {
    controller.current = null;
    if (!paper || !accountId) { setView(initial); return; }
    const scope = { accountId: accountId.toLowerCase(), attemptId: attemptId.toLowerCase() };
    let alive = true, busy = false, draining = false, retries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let request: CbtWritingSessionRequest | null = null, lease: Lease | null = null;
    let snapshot: CbtV2Snapshot | null = null, rows: AnswerOperation[] = [], phase: Phase = 'loading', message = '';
    let hasSnapshot = false;
    let journal: IndexedDbAnswerJournal, tabId = '', releaseTab: (() => void) | undefined;
    const reserveTab = async () => {
      if (!navigator.locks) throw new Error('CBT cross-tab coordination is unavailable.');
      const storageKey = `edureach-cbt-tab:${scope.accountId}:${scope.attemptId}`;
      let id = sessionStorage.getItem(storageKey) || '';
      if (!CBT_UUID.test(id)) id = crypto.randomUUID();
      for (let tries = 0; tries < 2; tries++) {
        const locked = await new Promise<boolean>((resolve, reject) => {
          navigator.locks.request(`edureach-cbt-tab:${scope.accountId}:${scope.attemptId}:${id}`, { ifAvailable: true }, async lock => {
            if (!lock) { resolve(false); return; }
            resolve(true);
            await new Promise<void>(done => { releaseTab = done; if (!alive) done(); });
          }).catch(reject);
        });
        if (locked) { sessionStorage.setItem(storageKey, id); return id; }
        id = crypto.randomUUID(); // Duplicated tab: cloned sessionStorage is not a lease.
      }
      throw new Error('CBT tab coordination is unavailable.');
    };
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(`edureach-cbt-session:${scope.accountId}:${scope.attemptId}`);
    const current = () => {
      if (!alive || account.current?.toLowerCase() !== scope.accountId) throw new Error('CBT account or page changed.');
    };
    const publish = () => {
      if (!alive || account.current?.toLowerCase() !== scope.accountId) return;
      const answers: Record<number, number> = { ...(snapshot?.answers || {}) };
      // Project only intent based on the exact current server revision, and
      // only under its original lease. All other intent is shown for review.
      for (const row of rows) if (row.status === 'pending' && lease && row.sessionId === lease.sessionId && row.sessionGeneration === lease.sessionGeneration &&
          snapshot && row.expectedRevision === snapshot.revision && row.baseAnswer === (snapshot.answers[String(row.position)] ?? null)) {
        if (row.selected === null) delete answers[row.position]; else answers[row.position] = row.selected;
      }
      setView({ phase, answers, rows, busy, message, hasSnapshot });
    };
    const refresh = async () => {
      current(); const next = await fetchCbtV2State(scope.attemptId); current();
      if (snapshot && next.revision < snapshot.revision) throw new Error('CBT server revision went backwards.');
      const nextRows = await journal.list(scope); current();
      validateCbtJournalPaper(next, paper, nextRows);
      projectCbtJournal(scope, next, paper, nextRows.filter(row => !['pending', 'conflicted', 'closed'].includes(row.status)));
      snapshot = next; rows = nextRows; hasSnapshot = true; publish();
    };
    const transport: QueueTransport = {
      state: async () => {
        current(); const state = await fetchCbtV2State(scope.attemptId); current();
        validateCbtJournalPaper(state, paper, []);
        if (snapshot && state.revision < snapshot.revision) throw new Error('CBT server revision went backwards.');
        snapshot = state;
        return state;
      },
      answer: async (_, body) => {
        current();
        if (!lease || !body.sessionId || body.sessionId !== lease.sessionId || body.sessionGeneration !== lease.sessionGeneration) throw new CbtWritingSessionRevokedError();
        const used = lease;
        const response = await sendCbtV2Operation(scope.attemptId, 'answer', { ...body, sessionId: used.sessionId, sessionGeneration: used.sessionGeneration });
        current();
        if (lease !== used) throw new CbtWritingSessionRevokedError();
        if (response.answers && response.revision !== undefined && response.status && snapshot) {
          const state = { protocol: 2 as const, revision: response.revision, answers: response.answers, status: response.status, questionIds: snapshot.questionIds };
          validateCbtJournalPaper(state, paper, []);
          if (response.revision < snapshot.revision) throw new Error('CBT server revision went backwards.');
          snapshot = state;
        }
        return response;
      },
    };
    let queue: CbtAnswerQueue;
    const reloadRows = async () => { rows = await journal.list(scope); current(); publish(); };
    const stop = (why: Phase, text: string) => { lease = null; phase = why; message = text; if (timer) clearTimeout(timer); publish(); };
    const schedule = () => {
      if (!alive || phase !== 'active' || retries >= 3 || timer) return;
      timer = setTimeout(() => { timer = undefined; void drain(); }, 1000 * 2 ** retries++);
    };
    const drain = async () => {
      if (draining || phase !== 'active' || !lease) return;
      draining = true;
      let attemptedLease: Lease | null = null;
      try {
        await reloadRows();
        for (const row of rows) {
          if (phase !== 'active' || !lease) break;
          if (row.status === 'conflicted' || row.status === 'closed') break;
          if (row.status !== 'pending') continue;
          if (row.sessionId !== lease.sessionId || row.sessionGeneration !== lease.sessionGeneration) {
            message = 'Earlier unsaved work needs review. It will not be sent under this session.'; break;
          }
          busy = true; attemptedLease = lease; publish();
          const result = await queue.retry(row.operationKey); current();
          await refresh();
          if (result.status !== 'acknowledged') { message = 'An answer needs your review.'; break; }
          retries = 0;
        }
      } catch (error) {
        if (!alive) return;
        if (error instanceof CbtWritingSessionRevokedError) {
          stop('revoked', 'This writing session was replaced. Unsaved answers remain on this device for review.');
          // Keep the original intent and key, but record an authoritative
          // comparison when available. Failure leaves it pending, never lost.
          try {
            for (const row of await journal.list(scope)) if (row.status === 'pending' && attemptedLease && row.sessionId === attemptedLease.sessionId && row.sessionGeneration === attemptedLease.sessionGeneration) {
              try { await queue.reviewPending(row.operationKey); } catch { /* preserved for later review */ }
            }
          } catch { /* storage failure leaves existing rows untouched */ }
        } else {
          message = 'An answer is not confirmed saved. Check your connection or review the pending work.';
          schedule();
        }
      } finally {
        draining = false; busy = false;
        if (alive) { try { await reloadRows(); } catch { stop('error', 'Browser storage is unavailable. Pending answers have not been discarded.'); } }
      }
    };
    const acquire = async () => {
      if (!request) throw new Error('CBT session request unavailable.');
      current(); const result = await openCbtV2WritingSession(scope.attemptId, request.requestKey, request.takeover); current();
      if (result.outcome === 'takeover_required' || result.outcome === 'revoked') {
        stop(result.outcome === 'revoked' ? 'revoked' : 'takeover', 'Another writing session is active or this session was replaced. Take over only after reviewing your other device.'); return;
      }
      if (result.outcome === 'expired') { stop('expired', 'This attempt has expired. Pending answers remain in this browser.'); return; }
      if (!result.sessionId || !result.generation) throw new Error('Invalid CBT session response.');
      await journal.rememberWritingSession(scope, request.requestKey, result.sessionId, result.generation, tabId); current();
      const nextLease = { sessionId: result.sessionId.toLowerCase(), sessionGeneration: result.generation };
      // Check the response against the validated paper and never regress revision.
      if (!snapshot || result.revision < snapshot.revision) throw new Error('CBT session state requires review.');
      const sessionState = { ...snapshot, revision: result.revision, answers: result.answers, status: result.status };
      validateCbtJournalPaper(sessionState, paper, []);
      snapshot = sessionState;
      lease = nextLease; phase = 'active'; message = '';
      if (result.outcome === 'taken_over') channel?.postMessage(nextLease);
      await refresh();
      await drain();
    };
    const run = async (action: () => Promise<void>) => {
      if (busy || !alive) return;
      busy = true; publish();
      try { await action(); }
      catch {
        if (alive) {
          message = 'Unable to confirm this action. Your pending answers remain in this browser; try again or review them.';
          try {
            await reloadRows();
            if (phase === 'loading' || !rows.some(row => row.status === 'pending' || row.status === 'conflicted')) { lease = null; phase = 'error'; }
          } catch { lease = null; phase = 'error'; }
        }
      } finally { busy = false; publish(); }
    };
    channel && (channel.onmessage = event => {
      const next = event.data as Partial<Lease> | null;
      if (lease && next && (next.sessionId !== lease.sessionId || next.sessionGeneration !== lease.sessionGeneration)) {
        // Notification can only stop sends; it never grants ownership.
        stop('revoked', 'A session takeover was reported in another tab. Unsaved answers remain here for review.');
      }
    });
    controller.current = {
      choose: async (question, selected) => run(async () => {
        current();
        if (phase !== 'active' || !lease || !snapshot || rows.some(row => ['pending', 'conflicted', 'closed'].includes(row.status))) return;
        if (selected !== null && (selected < 0 || selected >= question.options.length)) return;
        const used = lease;
        await queue.enqueue(question.id, question.position, selected, snapshot.answers[String(question.position)] ?? null, snapshot.revision, used);
        current(); await reloadRows();
        // Never rebind if a takeover happened while the IndexedDB transaction committed.
        if (lease === used && phase === 'active') { busy = false; await drain(); }
      }),
      takeover: async () => run(async () => {
        current(); lease = null; phase = 'loading'; publish();
        const latest = await journal.beginWritingSession(scope, crypto.randomUUID(), tabId); current();
        request = await journal.requestWritingTakeover(scope, latest.requestKey, crypto.randomUUID(), tabId); current();
        await acquire();
      }),
      retry: async () => run(async () => {
        current(); retries = 0;
        if (phase === 'active') { busy = false; await drain(); }
        else { request = await journal.beginWritingSession(scope, crypto.randomUUID(), tabId); current(); await acquire(); }
      }),
      review: async key => run(async () => { current(); if (phase !== 'active' || !lease) return; await queue.reviewPending(key); current(); await refresh(); }),
      resolve: async (row, choice) => run(async () => {
        current(); if (phase !== 'active' || !lease) return;
        const used = lease;
        await queue.resolve(row.operationKey, choice, row.lastServerRevision, row.lastServerAnswer, used); current();
        await refresh();
        if (lease === used && phase === 'active') { busy = false; await drain(); }
      }),
    };
    const online = () => { if (phase === 'active') { retries = 0; if (timer) clearTimeout(timer); timer = undefined; void drain(); } };
    window.addEventListener('online', online);
    void (async () => {
      try {
        current(); tabId = await reserveTab(); current(); journal = new IndexedDbAnswerJournal();
        snapshot = await fetchCbtV2State(scope.attemptId); current();
        rows = await journal.list(scope); current(); validateCbtJournalPaper(snapshot, paper, rows);
        projectCbtJournal(scope, snapshot, paper, rows.filter(row => !['pending', 'conflicted', 'closed'].includes(row.status)));
        hasSnapshot = true;
        queue = new CbtAnswerQueue(scope, journal, transport);
        request = await journal.beginWritingSession(scope, crypto.randomUUID(), tabId); current();
        await acquire();
      } catch {
        if (alive) stop('error', 'The writing session or browser storage could not be confirmed. No answers were sent.');
      }
    })();
    return () => { alive = false; controller.current = null; releaseTab?.(); if (timer) clearTimeout(timer); channel?.close(); window.removeEventListener('online', online); if (journal!) void journal.close().catch(() => {}); };
  }, [accountId, attemptId, paper]);
  return { ...view, choose: (q: CbtQuestionPayload, v: QueueAnswer) => controller.current?.choose(q, v), takeover: () => controller.current?.takeover(), retry: () => controller.current?.retry(), review: (key: string) => controller.current?.review(key), resolve: (row: AnswerOperation, choice: 'local' | 'server') => controller.current?.resolve(row, choice) };
}
