import { localStorageKey } from './localPreview';

const DB_NAME = 'EduReachCBT_DB';
const DB_VERSION = 2;

function scopedExamId(examId: string) {
  return localStorageKey(`exam-${examId}`);
}

export interface OfflineExamPackage {
  examId: string;
  subject: string;
  year: number;
  durationMinutes: number;
  questions: Array<{ id: number; questionText: string; options: string[] }>;
  cachedAt: number;
}

export interface OfflineProgressState {
  examId: string;
  answers: Record<number, number>;
  flags: Record<number, boolean>;
  timeRemainingSeconds: number;
  /** Zero-based question position so an unfinished test reopens at the same place. */
  questionIndex?: number;
  lastUpdated: number;
}

export interface OfflineSubmission {
  queueId: string;
  attemptId: string;
  examId: string;
  answers: Record<number, number>;
  timeSpentSeconds: number;
  queuedAt: number;
}

export function openCBTDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB is not supported in this browser.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = (event as IDBVersionChangeEvent).oldVersion;
      if (request.transaction && oldVersion < 2 && db.objectStoreNames.contains('pending_submissions')) {
        db.deleteObjectStore('pending_submissions');
      }
      if (!db.objectStoreNames.contains('question_packs')) db.createObjectStore('question_packs', { keyPath: 'examId' });
      if (!db.objectStoreNames.contains('active_progress')) db.createObjectStore('active_progress', { keyPath: 'examId' });
      if (!db.objectStoreNames.contains('pending_submissions')) db.createObjectStore('pending_submissions', { keyPath: 'queueId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open CBT storage.'));
  });
}

async function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

export async function cacheQuestionPack(pack: OfflineExamPackage): Promise<void> {
  const db = await openCBTDatabase();
  const tx = db.transaction('question_packs', 'readwrite');
  tx.objectStore('question_packs').put({ ...pack, examId: scopedExamId(pack.examId), cachedAt: Date.now() });
  await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
  db.close();
}

export async function getCachedQuestionPack(examId: string): Promise<OfflineExamPackage | null> {
  const db = await openCBTDatabase();
  const value = await requestResult(db.transaction('question_packs', 'readonly').objectStore('question_packs').get(scopedExamId(examId))) as (OfflineExamPackage & { examId: string }) | undefined;
  db.close();
  return value ? { ...value, examId } : null;
}

export async function saveExamProgress(progress: OfflineProgressState): Promise<void> {
  const db = await openCBTDatabase();
  const tx = db.transaction('active_progress', 'readwrite');
  tx.objectStore('active_progress').put({ ...progress, examId: scopedExamId(progress.examId), lastUpdated: Date.now() });
  await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
  db.close();
}

export async function getExamProgress(examId: string): Promise<OfflineProgressState | null> {
  const db = await openCBTDatabase();
  const value = await requestResult(db.transaction('active_progress', 'readonly').objectStore('active_progress').get(scopedExamId(examId))) as (OfflineProgressState & { examId: string }) | undefined;
  db.close();
  return value ? { ...value, examId } : null;
}

export async function clearExamProgress(examId: string): Promise<void> {
  const db = await openCBTDatabase();
  db.transaction('active_progress', 'readwrite').objectStore('active_progress').delete(scopedExamId(examId));
  db.close();
}

export async function queueOfflineSubmission(submission: Omit<OfflineSubmission, 'queuedAt' | 'queueId'>): Promise<void> {
  const db = await openCBTDatabase();
  const tx = db.transaction(['pending_submissions', 'active_progress'], 'readwrite');
  tx.objectStore('pending_submissions').put({ ...submission, queueId: crypto.randomUUID(), queuedAt: Date.now() });
  tx.objectStore('active_progress').delete(scopedExamId(submission.examId));
  await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
  db.close();
}

export async function syncPendingSubmissions(submitApiCall: (payload: OfflineSubmission) => Promise<boolean>): Promise<number> {
  if (typeof window === 'undefined' || !navigator.onLine) return 0;
  const db = await openCBTDatabase();
  const items = await requestResult(db.transaction('pending_submissions', 'readonly').objectStore('pending_submissions').getAll()) as OfflineSubmission[];
  let synced = 0;
  for (const item of items) {
    try {
      if (await submitApiCall(item)) {
        const tx = db.transaction('pending_submissions', 'readwrite');
        tx.objectStore('pending_submissions').delete(item.queueId);
        await new Promise<void>((resolve) => { tx.oncomplete = () => resolve(); tx.onerror = () => resolve(); });
        synced += 1;
      }
    } catch { /* keep queued */ }
  }
  db.close();
  return synced;
}
