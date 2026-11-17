import { BookOpen, FileText, Laptop, LogIn } from 'lucide-react';
import HubLayout from '../src/components/HubLayout';
import ExamSimulatorGrid from '../src/components/ExamSimulatorGrid';
import SectionHead from '../src/components/SectionHead';
import { useAuth } from '../src/lib/auth';
import { SIMULATOR_HUB_COPY, simulatorExamType } from '../src/data/simulators';

/**
 * The public Practice page.
 *
 * Practice answers exactly one question: *which CBT can I take?* It is the
 * simulator hub, so every examination simulator appears here through the shared
 * catalogue, and nothing else does — no practice history, results, analytics,
 * services or news. Those belong to the authenticated dashboard (Results) or
 * their own public pages.
 *
 * A visitor can understand and compare every simulator without an account.
 * Starting one still follows the existing authentication rule: the session is
 * saved to a student's account, so the setup step asks them to sign in.
 */
export default function CbtPage() {
  const { isAuthenticated, isLoading } = useAuth();
  // The exam hubs deep-link here as /cbt?mode=jamb. The grid opens on that
  // examination, and choosing another pill rewrites the query so the address
  // stays shareable.
  const requestedMode = (() => {
    try {
      return simulatorExamType(new URLSearchParams(window.location.search).get('mode') || '') ?? 'ALL';
    } catch {
      return 'ALL';
    }
  })();
  const syncModeToUrl = (id: string) => {
    try {
      window.history.replaceState({}, '', id === 'ALL' ? '/cbt' : `/cbt?mode=${encodeURIComponent(id)}`);
    } catch {
      // A restricted history API does not stop the filter from working.
    }
  };

  return (
    <HubLayout>
      <div className="hub-page er-practice-page">
        <div className="hub-container hub-narrow">
          <header className="er-practice-head">
            <div>
              <p className="hub-eyebrow">Practice</p>
              <h1>{SIMULATOR_HUB_COPY.practice.title}</h1>
              <p>{SIMULATOR_HUB_COPY.practice.lede}</p>
            </div>
            {!isLoading && (isAuthenticated ? (
              <a className="hub-outline-btn er-practice-signin" href="/dashboard/cbt">
                <Laptop size={14} aria-hidden="true" /> Open CBT in my dashboard
              </a>
            ) : (
              <a className="hub-outline-btn er-practice-signin" href={`/login?next=${encodeURIComponent('/dashboard/cbt')}`}>
                <LogIn size={14} aria-hidden="true" /> Sign in to save results
              </a>
            ))}
          </header>

          <section className="er-section" aria-label="CBT simulators" style={{ marginTop: 0 }}>
            <SectionHead title="Choose a simulator" />
            <ExamSimulatorGrid key={requestedMode} showFilters initialFilter={requestedMode} onFilterChange={syncModeToUrl} />
          </section>

          {/* Practice/Questions is one destination: the simulators above, and
              the offline past-paper library below. One quiet row, not a second
              card grid competing with the simulators. */}
          <section className="er-section er-practice-questions" aria-label="Past questions">
            <SectionHead title="Revise with past questions" />
            <ul className="er-home-tool-list">
              <li>
                <a href="/past-questions">
                  <FileText size={16} aria-hidden="true" />
                  <span>Past questions by exam and subject</span>
                  <BookOpen size={13} aria-hidden="true" />
                </a>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </HubLayout>
  );
}
