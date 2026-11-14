import { userFacingError } from '../../../lib/errors';
import { useMemo, useState } from 'react';
import { Calculator, Plus, Trash2 } from 'lucide-react';
import { calculateCgpa, gradesForScale, gradePointsByScale, saveCgpaSnapshot, type CgpaCourseInput, type CgpaScale, type CgpaSnapshot } from '../../lib/studentDashboard';
import { localStorageKey } from '../../lib/localPreview';

const localCoursesKey = () => localStorageKey('cgpa-courses');

function readLocalCourses(): CgpaCourseInput[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(localCoursesKey()) || 'null');
    return Array.isArray(parsed) && parsed.length ? parsed : [];
  } catch {
    return [];
  }
}

/** Nigerian CGPA calculator (4.0 or 5.0 scale), rendered inline on the dashboard Tools page.
 * 4.0 snapshots are kept on this device only: student_cgpa_terms has no scale
 * column, so writing a 4.0 result there would silently corrupt a 5.0 record. */
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
  const [scale, setScale] = useState<CgpaScale>(() => {
    try { return localStorage.getItem(localStorageKey('cgpa-scale')) === '4' ? 4 : 5; } catch { return 5; }
  });
  const result = useMemo(() => calculateCgpa(courses, scale), [courses, scale]);

  const changeScale = (next: CgpaScale) => {
    setScale(next);
    // The 4.0 table has no E grade; remap those rows rather than dropping them.
    if (next === 4) setCourses((rows) => rows.map((c) => (c.grade === 'E' ? { ...c, grade: 'F' } : c)));
    try { localStorage.setItem(localStorageKey('cgpa-scale'), String(next)); } catch { /* session-only */ }
  };

  const clearAll = () => {
    const blank = [{ code: '', units: 2, grade: 'A' }];
    setCourses(blank); setMessage('');
    try { localStorage.setItem(localCoursesKey(), JSON.stringify(blank)); } catch { /* session-only */ }
  };

  const update = (index: number, patch: Partial<CgpaCourseInput>) => {
    const next = courses.map((course, i) => (i === index ? { ...course, ...patch } : course));
    setCourses(next);
    try {
      localStorage.setItem(localCoursesKey(), JSON.stringify(next));
    } catch {
      // storage unavailable - calculator still works for this session
    }
  };

  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      if (isLocalMode || !userId || scale === 4) {
        onSnapshotSaved({
          id: `local-cgpa-${Date.now()}`,
          termLabel: 'Current Semester',
          gpa: result.gpaText,
          totalUnits: result.totalUnits,
          classification: result.classification,
          createdAt: new Date().toISOString(),
          courses,
          scale,
        });
        setMessage(scale === 4
          ? 'Saved on this device. 4.0 snapshots are local estimates and are not written to your student record.'
          : 'Saved on this device. Sign in with a connected account to keep it on your student record.');
        return;
      }
      const snapshot = await saveCgpaSnapshot(userId, courses);
      onSnapshotSaved(snapshot);
      setMessage('CGPA snapshot saved to your student record.');
    } catch (err) {
      setMessage(userFacingError(err, 'Unable to save CGPA snapshot.'));
    } finally {
      setSaving(false);
    }
  };

  const addCourse = () => {
    const nextCourses = [...courses, { code: '', units: 2, grade: 'A' }];
    setCourses(nextCourses);
    try {
      localStorage.setItem(localCoursesKey(), JSON.stringify(nextCourses));
    } catch {
      // storage unavailable - calculator still works for this session
    }
  };

  return (
    <section className="dash-card dash-cgpa" id="cgpa">
      <div className="dash-cgpa-top">
        <div>
          <h2 className="dash-card-title"><Calculator size={14} className="dash-card-title-icon" /> CGPA calculator</h2>
          <p className="dash-card-help">One workspace for both Nigerian grading systems. Your estimate updates as you type.</p>
        </div>
        <div className="dash-segmented" role="group" aria-label="Grading scale">
          {([4, 5] as CgpaScale[]).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={scale === option}
              className={scale === option ? 'is-active' : undefined}
              onClick={() => changeScale(option)}
            >
              {option.toFixed(1)} scale
            </button>
          ))}
        </div>
      </div>

      <div className="dash-cgpa-layout">
        <aside className="dash-cgpa-summary" aria-label="CGPA estimate">
          <span className="dash-cgpa-summary-label">Estimated GPA</span>
          <div className="dash-cgpa-value">{result.gpaText}<small>/ {scale.toFixed(1)}</small></div>
          <span className="dash-cgpa-class">{result.totalUnits ? result.classification : 'Add your courses and grades'}</span>
          <span className="dash-cgpa-summary-rule" aria-hidden="true" />
          <dl className="dash-cgpa-stats">
            <div><dt>Credit units</dt><dd>{result.totalUnits || 0}</dd></div>
            <div><dt>Courses</dt><dd>{courses.length}</dd></div>
          </dl>
          <p className="dash-cgpa-note">Estimate only, not an official transcript. Bands vary by institution.</p>
        </aside>

        <div className="dash-cgpa-editor">
          <div className="dash-cgpa-rows">
            <div className="dash-cgpa-row dash-cgpa-head-row" aria-hidden="true">
              <span>Course</span><span>Units</span><span>Grade</span><span />
            </div>
            {courses.map((course, index) => (
              <div className="dash-cgpa-row" key={index}>
                <label className="dash-cgpa-field">
                  <span>Course {index + 1}</span>
                  <input type="text" value={course.code} onChange={(e) => update(index, { code: e.target.value })} placeholder="e.g. MTH101" aria-label={`Course ${index + 1} code`} />
                </label>
                <label className="dash-cgpa-field">
                  <span>Units</span>
                  <input type="number" min={1} max={6} value={course.units} onChange={(e) => update(index, { units: Number(e.target.value) || 1 })} aria-label={`Course ${index + 1} units`} />
                </label>
                <label className="dash-cgpa-field">
                  <span>Grade</span>
                  <select value={course.grade} onChange={(e) => update(index, { grade: e.target.value })} aria-label={`Course ${index + 1} grade`}>
                    {gradesForScale(scale).map((g) => <option key={g} value={g}>{g} · {gradePointsByScale[scale][g]} points</option>)}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const next = courses.filter((_, i) => i !== index);
                    const nextCourses = next.length ? next : [{ code: '', units: 2, grade: 'A' }];
                    setCourses(nextCourses);
                    try {
                      localStorage.setItem(localCoursesKey(), JSON.stringify(nextCourses));
                    } catch {
                      // storage unavailable - calculator still works for this session
                    }
                  }}
                  aria-label={`Remove course ${index + 1}`}
                  className="dash-cgpa-remove"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>

          <button type="button" className="dash-cgpa-add" onClick={addCourse}><Plus size={15} /> Add course</button>
        </div>
      </div>

      <div className="dash-cgpa-footer">
        <div className="dash-cgpa-footnote">
          {latestSnapshot && (
            <p>Last saved: {latestSnapshot.gpa}/{ (latestSnapshot.scale ?? 5).toFixed(1) } · {latestSnapshot.totalUnits} units · {latestSnapshot.classification}</p>
          )}
          {message && <p className={`dash-cgpa-message ${message.toLowerCase().includes('unable') ? 'is-error' : 'is-success'}`}>{message}</p>}
          {!latestSnapshot && !message && <p>Save a semester to keep the estimate on your dashboard.</p>}
        </div>
        <div className="dash-cgpa-actions">
          <button type="button" className="dash-btn dash-btn-secondary" onClick={clearAll}>Clear</button>
          <button type="button" className="dash-btn dash-btn-primary" onClick={save} disabled={saving || !result.totalUnits}>{saving ? 'Saving…' : 'Save snapshot'}</button>
        </div>
      </div>
    </section>
  );
}
