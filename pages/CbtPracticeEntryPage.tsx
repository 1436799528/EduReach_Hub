import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import HubLayout from '../src/components/HubLayout';
import { ErrorState } from '../src/components/AsyncState';
import { fetchCbtExams } from '../src/lib/api';
import { resolveSetupExam, type CatalogExam, type SetupExamKey } from '../src/lib/cbt-config';

/**
 * Legacy entry point for `/cbt/practice`.
 *
 * The old hall let a student walk straight into a paper with whatever the URL
 * carried, which is how a mismatched subject combination turned into
 * "This CBT is not ready yet" inside the exam. Practice now always starts from a
 * configuration the bank can actually serve, so this route resolves the bank and
 * forwards the student (and any subject wish from the link) to the setup wizard.
 */
const EXAM_KEYS: SetupExamKey[] = ['jamb', 'waec', 'neco', 'post-utme'];

function guessKeyFromId(value: string): SetupExamKey | null {
  const normalized = value.toLowerCase();
  for (const key of EXAM_KEYS) {
    if (normalized.includes(key)) return key;
  }
  if (normalized.includes('utme')) return 'jamb';
  if (normalized.includes('ssce')) return 'waec';
  return null;
}

function navigateInApp(path: string) {
  window.history.replaceState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export default function CbtPracticeEntryPage() {
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const requestedId = params.get('exam');
    const requestedSubjects = params.get('subjects') || params.get('subject') || '';
    const requestedMode = params.get('mode') === 'mock' ? 'mock' : 'practice';

    void fetchCbtExams()
      .then((exams) => {
        if (!active) return;
        const typed = exams as CatalogExam[];
        const matched = requestedId ? typed.find((exam) => exam.id === requestedId) : undefined;
        const key = matched
          ? EXAM_KEYS.find((candidate) => resolveSetupExam([matched], candidate, matched.id) !== null) ?? guessKeyFromId(matched.exam_body || matched.title || '')
          : guessKeyFromId(requestedId || '');
        const resolvedKey = key || 'jamb';
        const target = resolveSetupExam(typed, resolvedKey, requestedId) || matched || null;

        const next = new URLSearchParams();
        if (target?.id) next.set('exam', target.id);
        next.set('mode', requestedMode);
        if (requestedSubjects) next.set('subjects', requestedSubjects);
        navigateInApp(`/cbt/setup/${resolvedKey}?${next.toString()}`);
      })
      .catch((value) => { if (active) setError(value); });

    return () => { active = false; };
  }, []);

  if (error) {
    return (
      <HubLayout>
        <div className="hub-page" style={{ padding: '22px 0 64px' }}>
          <div className="hub-container hub-narrow" style={{ maxWidth: '720px' }}>
            <ErrorState error={error} action={<a className="hub-outline-btn" href="/cbt">Back to the CBT Centre</a>} />
          </div>
        </div>
      </HubLayout>
    );
  }

  return (
    <HubLayout>
      <div className="hub-page" style={{ padding: '22px 0 64px' }}>
        <div className="hub-container hub-narrow" style={{ maxWidth: '720px' }}>
          <div className="er-state" role="status">
            <span className="er-state-icon" aria-hidden="true"><Loader2 className="er-spin" size={20} /></span>
            <div>
              <strong>Opening the CBT setup</strong>
              <p>Practice now starts from a session you configure — subjects, number of questions and time.</p>
            </div>
          </div>
        </div>
      </div>
    </HubLayout>
  );
}
