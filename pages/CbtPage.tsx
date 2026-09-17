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
      <style>{`
        .hub-cbt-setup-card{padding:24px}
        .hub-setup-header{display:flex;justify-content:space-between;gap:16px;align-items:start;margin-bottom:18px}
        .hub-setup-header h2,.hub-setup-section-title h2{margin:5px 0 0;font-size:20px}
        .hub-setup-progress{font-size:11px;font-weight:800;color:#98a2b3}
        .hub-subject-list{display:grid;gap:10px}
        .hub-fixed-subject,.hub-subject-select{min-height:54px;border:1px solid var(--hub-border);border-radius:10px;background:#fff;padding:10px 13px}
        .hub-fixed-subject{display:flex;justify-content:space-between;align-items:center}
        .hub-fixed-subject div{display:grid;gap:3px}.hub-fixed-subject strong{font-size:13px}.hub-fixed-subject span{font-size:11px;color:#98a2b3}
        .hub-subject-check{width:25px;height:25px;border-radius:50%;display:grid;place-items:center;background:#dcfce7;color:#059669;font-weight:900}
        .hub-subject-select{display:grid;grid-template-columns:110px 1fr;gap:12px;align-items:center}
        .hub-subject-select>span{font-size:12px;font-weight:800;color:#475467}
        .hub-subject-select select,.hub-form-grid.compact select{width:100%;height:40px;border:1px solid var(--hub-border);border-radius:8px;padding:0 10px;background:#fff;font:inherit;outline:0}
        .hub-setup-section{margin-top:24px;padding-top:22px;border-top:1px solid #eef0f3}
        .hub-mode-grid.compact{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
        .hub-mode-card{border:1px solid var(--hub-border);background:#fff;border-radius:10px;padding:14px;text-align:left;display:grid;gap:5px;cursor:pointer}
        .hub-mode-card strong{font-size:13px}.hub-mode-card span{font-size:11px;color:var(--hub-muted);line-height:1.5}
        .hub-mode-card.active{border-color:#93c5fd;background:#eff6ff;box-shadow:inset 0 0 0 1px #bfdbfe}
        .hub-form-grid.compact{grid-template-columns:repeat(3,minmax(0,1fr));margin-top:18px}
        .hub-option-row{display:flex;flex-wrap:wrap;gap:14px;margin-top:18px;padding-top:16px;border-top:1px solid #eef0f3}
        .hub-check-option{display:flex;align-items:center;gap:8px;font-size:12px;color:#475467;cursor:pointer}
        .hub-check-option input{accent-color:var(--hub-blue)}
        .hub-setup-footer{display:flex;justify-content:space-between;align-items:center;gap:18px;margin-top:22px;padding-top:18px;border-top:1px solid #eef0f3}
        .hub-setup-footer>div{display:grid;gap:3px}.hub-setup-footer strong{font-size:13px}.hub-setup-footer small{font-size:11px;color:#98a2b3}
        .hub-inline-help{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:16px;padding:14px 16px;border:1px solid var(--hub-border);border-radius:10px;background:#fff;color:#667085;font-size:12px}
        .hub-inline-help strong{color:#344054}.hub-inline-help a{color:var(--hub-blue);font-weight:800;margin-left:auto}
        @media (max-width:680px){.hub-cbt-setup-card{padding:18px}.hub-subject-select{grid-template-columns:1fr}.hub-form-grid.compact,.hub-mode-grid.compact{grid-template-columns:1fr}.hub-setup-footer{align-items:stretch;flex-direction:column}.hub-setup-footer .hub-primary-btn{width:100%}.hub-inline-help a{margin-left:0}.hub-page-title.compact h1{font-size:30px}}
      `}</style>

      <div className="hub-page">
        <div className="hub-container hub-narrow">
          <div className="hub-page-title compact">
            <span className="hub-eyebrow">CBT PRACTICE</span>
            <h1>Set up your JAMB practice.</h1>
            <p>Choose your subjects, test mode and question count, then enter the practice room.</p>
          </div>

          <div className="hub-panel hub-cbt-setup-card">
            <div className="hub-setup-header">
              <div><span className="hub-eyebrow">STEP 1</span><h2>Select subjects</h2></div>
              <span className="hub-setup-progress">1 / 3</span>
            </div>

            <div className="hub-subject-list">
              <div className="hub-fixed-subject">
                <div><strong>Use of English</strong><span>Compulsory</span></div>
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
              <div className="hub-setup-section-title"><span className="hub-eyebrow">STEP 2</span><h2>Choose your test</h2></div>
              <div className="hub-mode-grid compact">
                <button type="button" className={`hub-mode-card ${mode === 'practice' ? 'active' : ''}`} onClick={() => setMode('practice')}><strong>Practice Mode</strong><span>Work through questions at your pace.</span></button>
                <button type="button" className={`hub-mode-card ${mode === 'full' ? 'active' : ''}`} onClick={() => setMode('full')}><strong>Full Test Mode</strong><span>Use a timed exam-style session.</span></button>
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
              <div><span className="hub-eyebrow">READY</span><strong>{examBody} · {year} · {count} questions</strong><small>Use of English + {selected.filter(Boolean).length} selected subject(s) · {mode === 'practice' ? 'Practice' : 'Full test'} mode</small></div>
              <a className="hub-primary-btn" href={`/cbt/practice?subject=${selected.join(',')}&body=${examBody}&year=${year}&count=${count}&mode=${mode}&novel=${novel}&comprehension=${comprehension}`}>Start Practice</a>
            </div>
          </div>

          <div className="hub-inline-help"><strong>Need to study first?</strong><span>Review past questions before starting the test.</span><a href="/services">Browse Student Services</a></div>
        </div>
      </div>
    </HubLayout>
  );
}
