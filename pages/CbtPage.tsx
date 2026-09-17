import { useMemo, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import { cbtSubjects } from '../src/data/hubContent';

const otherSubjects = cbtSubjects.filter((item) => item.key !== 'english');

export default function CbtPage() {
  const [subjects, setSubjects] = useState(['mathematics', otherSubjects[1]?.key || '', otherSubjects[2]?.key || '']);
  const [examBody, setExamBody] = useState('JAMB');
  const [year, setYear] = useState('2026');
  const [count, setCount] = useState('20');
  const [mode, setMode] = useState('practice');
  const [novel, setNovel] = useState(false);
  const [comprehension, setComprehension] = useState(false);

  const selected = useMemo(() => subjects.filter(Boolean), [subjects]);

  function updateSubject(index: number, value: string) {
    setSubjects((current) => current.map((item, itemIndex) => itemIndex === index ? value : item));
  }

  return (
    <HubLayout>
      <div className="hub-page">
        <div className="hub-container hub-narrow">
          <div className="hub-page-title compact">
            <span className="hub-eyebrow">CBT PRACTICE</span>
            <h1>Set up your JAMB practice.</h1>
            <p>Choose your subjects, test mode and question count, then enter the practice room.</p>
          </div>

          <div className="hub-panel hub-cbt-setup-card">
            <div className="hub-setup-header">
              <div>
                <span className="hub-eyebrow">STEP 1</span>
                <h2>Select subjects</h2>
              </div>
              <span className="hub-setup-progress">1 / 3</span>
            </div>

            <div className="hub-subject-list">
              <div className="hub-fixed-subject">
                <div><strong>English Language</strong><span>Compulsory</span></div>
                <span className="hub-subject-check">✓</span>
              </div>

              {subjects.map((value, index) => (
                <label className="hub-subject-select" key={index}>
                  <span>Subject {index + 2}</span>
                  <select value={value} onChange={(event) => updateSubject(index, event.target.value)}>
                    <option value="">Select subject</option>
                    {otherSubjects.map((item) => <option key={item.key} value={item.key} disabled={selected.includes(item.key) && item.key !== value}>{item.name}</option>)}
                  </select>
                </label>
              ))}
            </div>

            <div className="hub-setup-section">
              <div className="hub-setup-section-title">
                <span className="hub-eyebrow">STEP 2</span>
                <h2>Choose your test</h2>
              </div>
              <div className="hub-mode-grid compact">
                <button className={`hub-mode-card ${mode === 'practice' ? 'active' : ''}`} onClick={() => setMode('practice')}>
                  <strong>Practice Mode</strong><span>Work through questions at your pace.</span>
                </button>
                <button className={`hub-mode-card ${mode === 'full' ? 'active' : ''}`} onClick={() => setMode('full')}>
                  <strong>Full Test Mode</strong><span>Use a timed exam-style session.</span>
                </button>
              </div>
            </div>

            <div className="hub-form-grid compact">
              <label>Exam Body<select value={examBody} onChange={(event) => setExamBody(event.target.value)}><option>JAMB</option><option>WAEC</option><option>POST-UTME</option></select></label>
              <label>Exam Year<select value={year} onChange={(event) => setYear(event.target.value)}><option>2026</option><option>2025</option><option>2024</option><option>2023</option></select></label>
              <label>Questions<select value={count} onChange={(event) => setCount(event.target.value)}><option>20</option><option>40</option><option>60</option></select></label>
            </div>

            <div className="hub-option-row">
              <label className="hub-check-option"><input type="checkbox" checked={novel} onChange={(event) => setNovel(event.target.checked)} /><span>Include current JAMB novel questions</span></label>
              <label className="hub-check-option"><input type="checkbox" checked={comprehension} onChange={(event) => setComprehension(event.target.checked)} /><span>Include extra English comprehension</span></label>
            </div>

            <div className="hub-setup-footer">
              <div><span className="hub-eyebrow">READY</span><strong>{examBody} · {year} · {count} questions</strong><small>English + {selected.filter(Boolean).length} selected subject(s) · {mode === 'practice' ? 'Practice' : 'Full test'} mode</small></div>
              <a className="hub-primary-btn" href={`/cbt/practice?subject=${selected.join(',')}&body=${examBody}&year=${year}&count=${count}&mode=${mode}&novel=${novel}&comprehension=${comprehension}`}>Start Practice</a>
            </div>
          </div>

          <div className="hub-inline-help">
            <strong>Need to study first?</strong>
            <span>Open a subject and review past questions before starting the timed test.</span>
            <a href="/services">Browse Student Services</a>
          </div>
        </div>
      </div>
    </HubLayout>
  );
}
