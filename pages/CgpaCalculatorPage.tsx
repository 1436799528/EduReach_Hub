import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import HubLayout from '../src/components/HubLayout';
import CgpaCalculatorCard from '../src/components/dashboard/CgpaCalculatorCard';
import { useAuth } from '../src/lib/auth';
import { isSupabaseConfigured } from '../src/lib/supabase';
import type { CgpaSnapshot } from '../src/lib/studentDashboard';

export default function CgpaCalculatorPage() {
  const { user, isAuthenticated } = useAuth();
  const [latestSnapshot, setLatestSnapshot] = useState<CgpaSnapshot | null>(null);

  return (
    <HubLayout>
      <main className="hub-page" style={{ padding: '24px 0 64px' }}>
        <div className="hub-container hub-narrow" style={{ maxWidth: '760px' }}>
          <div className="hub-section-heading hub-page-heading-compact" style={{ marginBottom: '18px' }}>
            <div>
              <span className="hub-eyebrow" style={{ color: '#C85841' }}>STUDENT ACADEMIC TOOLS</span>
              <h1>CGPA Calculator</h1>
              <p>Calculate your Nigerian 5.0-scale GPA and degree classification by credit units and grades.</p>
            </div>
            <a className="hub-outline-btn" href="/screening-calculator">
              Screening calculator <ArrowRight size={14} />
            </a>
          </div>

          <CgpaCalculatorCard
            userId={user?.id || ''}
            isLocalMode={!isSupabaseConfigured || !isAuthenticated}
            initialCourses={[]}
            latestSnapshot={latestSnapshot}
            onSnapshotSaved={(snapshot) => setLatestSnapshot(snapshot)}
          />
        </div>
      </main>
    </HubLayout>
  );
}
