import { useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import { cbtSubjects } from '../src/data/hubContent';

export default function CbtPage() {
  const [subject, setSubject] = useState(cbtSubjects[0].key);
  const [examBody, setExamBody] = useState('JAMB');
  const [year, setYear] = useState('2026');
  const [count, setCount] = useState('20');
  return <HubLayout><div className="hub-page"><div className="hub-container hub-narrow">
    <div className="hub-page-title"><span className="hub-eyebrow">CBT PRACTICE</span><h1>Choose a subject and start practicing.</h1><p>Configure an exam style, question count and year before entering the practice engine.</p></div>
    <div className="hub-cbt-subjects">{cbtSubjects.map((item) => <button key={item.key} className={`hub-subject-card hub-tone-${item.tone} ${subject === item.key ? 'active' : ''}`} onClick={() => setSubject(item.key)}><strong>{item.name}</strong><span>Up to {item.count} questions</span></button>)}</div>
    <div className="hub-panel hub-config-panel"><div><span className="hub-eyebrow">EXAM CONFIGURATION</span><h2>Set your practice</h2></div><div className="hub-form-grid"><label>Exam Body<select value={examBody} onChange={(e) => setExamBody(e.target.value)}><option>JAMB</option><option>WAEC</option><option>POST-UTME</option></select></label><label>Year<select value={year} onChange={(e) => setYear(e.target.value)}><option>2026</option><option>2025</option><option>2024</option><option>2023</option></select></label><label>Question Count<select value={count} onChange={(e) => setCount(e.target.value)}><option>20</option><option>40</option><option>60</option></select></label></div><div className="hub-config-summary"><span>{examBody} · {year}</span><strong>{cbtSubjects.find((item) => item.key === subject)?.name} · {count} questions</strong><a className="hub-primary-btn" href={`/cbt/practice?subject=${subject}&body=${examBody}&year=${year}&count=${count}`}>Start Practice</a></div></div>
  </div></div></HubLayout>;
}
