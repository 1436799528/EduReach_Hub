const DB_NAME = 'EduReachCBT_DB';
const DB_VERSION = 1;

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
  lastUpdated: number;
}

export interface OfflineSubmission {
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
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('question_packs')) db.createObjectStore('question_packs', { keyPath: 'examId' });
      if (!db.objectStoreNames.contains('active_progress')) db.createObjectStore('active_progress', { keyPath: 'examId' });
      if (!db.objectStoreNames.contains('pending_submissions')) db.createObjectStore('pending_submissions', { keyPath: 'examId' });
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
  tx.objectStore('question_packs').put({ ...pack, cachedAt: Date.now() });
  await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
  db.close();
}

export async function getCachedQuestionPack(examId: string): Promise<OfflineExamPackage | null> {
  const db = await openCBTDatabase();
  const value = await requestResult(db.transaction('question_packs', 'readonly').objectStore('question_packs').get(examId));
  db.close();
  return value ?? null;
}

export async function saveExamProgress(progress: OfflineProgressState): Promise<void> {
  const db = await openCBTDatabase();
  const tx = db.transaction('active_progress', 'readwrite');
  tx.objectStore('active_progress').put({ ...progress, lastUpdated: Date.now() });
  await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
  db.close();
}

export async function getExamProgress(examId: string): Promise<OfflineProgressState | null> {
  const db = await openCBTDatabase();
  const value = await requestResult(db.transaction('active_progress', 'readonly').objectStore('active_progress').get(examId));
  db.close();
  return value ?? null;
}

export async function clearExamProgress(examId: string): Promise<void> {
  const db = await openCBTDatabase();
  db.transaction('active_progress', 'readwrite').objectStore('active_progress').delete(examId);
  db.close();
}

export async function queueOfflineSubmission(submission: Omit<OfflineSubmission, 'queuedAt'>): Promise<void> {
  const db = await openCBTDatabase();
  const tx = db.transaction(['pending_submissions', 'active_progress'], 'readwrite');
  tx.objectStore('pending_submissions').put({ ...submission, queuedAt: Date.now() });
  tx.objectStore('active_progress').delete(submission.examId);
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
        tx.objectStore('pending_submissions').delete(item.examId);
        await new Promise<void>((resolve) => { tx.oncomplete = () => resolve(); tx.onerror = () => resolve(); });
        synced += 1;
      }
    } catch { /* keep queued */ }
  }
  db.close();
  return synced;
}
