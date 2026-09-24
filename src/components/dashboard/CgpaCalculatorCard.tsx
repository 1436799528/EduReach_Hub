import { useMemo, useState } from 'react';
import { Calculator, Trash2 } from 'lucide-react';
import { calculateCgpa, saveCgpaSnapshot, type CgpaCourseInput, type CgpaSnapshot } from '../../lib/studentDashboard';
import { localStorageKey } from '../../lib/localPreview';

const localCoursesKey = () => localStorageKey('cgpa-courses');
const fieldStyle = { padding: '8px 9px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '6px', width: '100%', boxSizing: 'border-box' } as const;

function readLocalCourses(): CgpaCourseInput[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(localCoursesKey()) || 'null');
    return Array.isArray(parsed) && parsed.length ? parsed : [];
  } catch {
    return [];
  }
}

/** Nigerian 5-point CGPA calculator, rendered inline on the dashboard Tools page. */
export default function CgpaCalculatorCard({
  userId,
  isLocalMode,
  initialCourses,
  latestSnapshot,
  onSnapshotSaved,
}: {
  userId: string;
  isLocalMode: boolean;
  initialCourses: CgpaCourseInput[];
  latestSnapshot: CgpaSnapshot | null;
  onSnapshotSaved: (snapshot: CgpaSnapshot) => void;
}) {
  const [courses, setCourses] = useState<CgpaCourseInput[]>(() => {
    if (initialCourses.length) return initialCourses;
    const local = readLocalCourses();
    return local.length ? local : [{ code: '', units: 2, grade: 'A' }];
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const result = useMemo(() => calculateCgpa(courses), [courses]);

  const update = (index: number, patch: Partial<CgpaCourseInput>) => {
    const next = courses.map((course, i) => (i === index ? { ...course, ...patch } : course));
    setCourses(next);
    try {
      localStorage.setItem(localCoursesKey(), JSON.stringify(next));
    } catch {
      // storage unavailable — calculator still works for this session
    }
  };

  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      if (isLocalMode || !userId) {
        onSnapshotSaved({
          id: `local-cgpa-${Date.now()}`,
          termLabel: 'Current Semester',
          gpa: result.gpaText,
          totalUnits: result.totalUnits,
          classification: result.classification,
          createdAt: new Date().toISOString(),
          courses,
        });
        setMessage('Saved on this device. Sign in with a connected account to keep it on your student record.');
        return;
      }
      const snapshot = await saveCgpaSnapshot(userId, courses);
      onSnapshotSaved(snapshot);
      setMessage('CGPA snapshot saved to your student record.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to save CGPA snapshot.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="dash-card" id="cgpa">
      <div className="dash-card-header">
        <h2 className="dash-card-title"><Calculator size={14} className="dash-card-title-icon" /> CGPA Calculator</h2>
        <span className="dash-card-meta">5.0 scale</span>
      </div>

      <div className="dash-cgpa-result">
        <span className="dash-metric-label">Estimated GPA</span>
        <div className="dash-cgpa-value">{result.gpaText} <small>/ 5.00</small></div>
        <span className="dash-cgpa-class">{result.totalUnits ? result.classification : 'Add your courses and grades below'}</span>
      </div>

      <div className="dash-cgpa-rows">
        <div className="dash-cgpa-row dash-cgpa-head" aria-hidden="true">
          <span>Course</span><span>Units</span><span>Grade</span><span />
        </div>
        {courses.map((course, index) => (
          <div key={index} className="dash-cgpa-row">
            <input type="text" value={course.code} onChange={(e) => update(index, { code: e.target.value })} placeholder={`Course ${index + 1}`} aria-label={`Course ${index + 1} code`} style={fieldStyle} />
            <input type="number" min={1} max={6} value={course.units} onChange={(e) => update(index, { units: Number(e.target.value) || 1 })} aria-label={`Course ${index + 1} units`} style={fieldStyle} />
            <select value={course.grade} onChange={(e) => update(index, { grade: e.target.value })} aria-label={`Course ${index + 1} grade`} style={fieldStyle}>
              <option value="A">A (5)</option>
              <option value="B">B (4)</option>
              <option value="C">C (3)</option>
              <option value="D">D (2)</option>
              <option value="E">E (1)</option>
              <option value="F">F (0)</option>
            </select>
            <button
              type="button"
              onClick={() => {
                const next = courses.filter((_, i) => i !== index);
                const nextCourses = next.length ? next : [{ code: '', units: 2, grade: 'A' }];
                setCourses(nextCourses);
                try {
                  localStorage.setItem(localCoursesKey(), JSON.stringify(nextCourses));
                } catch {
                  // storage unavailable — calculator still works for this session
                }
              }}
              aria-label={`Remove course ${index + 1}`}
              className="dash-icon-btn"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {latestSnapshot && (
        <div className="dash-note">Last saved: {latestSnapshot.gpa}/5.00 • {latestSnapshot.totalUnits} units • {latestSnapshot.classification}</div>
      )}
      {message && <div className={`dash-note ${message.toLowerCase().includes('unable') ? 'is-error' : 'is-success'}`}>{message}</div>}

      <div className="dash-btn-row">
        <button
          type="button"
          className="dash-btn dash-btn-secondary"
          onClick={() => {
            const nextCourses = [...courses, { code: '', units: 2, grade: 'A' }];
            setCourses(nextCourses);
            try {
              localStorage.setItem(localCoursesKey(), JSON.stringify(nextCourses));
            } catch {
              // storage unavailable — calculator still works for this session
            }
          }}
        >
          + Add Course
        </button>
        <button type="button" className="dash-btn dash-btn-primary" onClick={save} disabled={saving || !result.totalUnits}>{saving ? 'Saving…' : 'Save Snapshot'}</button>
      </div>
    </section>
  );
}
