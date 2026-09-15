import { FormEvent, useEffect, useState } from 'react';
import { supabase } from '../src/lib/supabase';
import AdminLayout from './AdminLayout';

type Question = { id: string; exam_type: string; subject: string; exam_year: number; question_text: string; option_a: string; option_b: string; option_c: string; option_d: string; correct_option: string; explanation: string | null; status: string };
const emptyForm = { exam_type: 'JAMB', subject: 'Use of English', exam_year: '2026', question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_option: 'A', explanation: '', status: 'published' };

export default function AdminCbtPage() {
  const [filters, setFilters] = useState({ exam_type: 'JAMB', subject: 'Use of English', exam_year: '2026' });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [openForm, setOpenForm] = useState(false);

  async function load() {
    const { data } = await supabase.from('cbt_questions').select('*').eq('exam_type', filters.exam_type).eq('subject', filters.subject).eq('exam_year', Number(filters.exam_year)).order('created_at', { ascending: false }).limit(100);
    setQuestions((data || []) as Question[]);
  }
  useEffect(() => { load(); }, [filters]);

  function startEdit(question?: Question) {
    if (!question) { setEditing(null); setForm(emptyForm); setOpenForm(true); return; }
    setEditing(question.id); setForm({ exam_type: question.exam_type, subject: question.subject, exam_year: String(question.exam_year), question_text: question.question_text, option_a: question.option_a, option_b: question.option_b, option_c: question.option_c, option_d: question.option_d, correct_option: question.correct_option, explanation: question.explanation || '', status: question.status }); setOpenForm(true);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const payload = { ...form, exam_year: Number(form.exam_year) };
    if (editing) await supabase.from('cbt_questions').update(payload).eq('id', editing);
    else await supabase.from('cbt_questions').insert(payload);
    setOpenForm(false); setEditing(null); setForm(emptyForm); await load();
  }

  async function remove(id: string) { if (window.confirm('Archive this question?')) { await supabase.from('cbt_questions').update({ status: 'archived' }).eq('id', id); await load(); } }

  return <AdminLayout><div className="admin-page">
    <div className="admin-page-header"><div><h1>CBT Question Bank Manager</h1><p>Manage JAMB, WAEC and POST-UTME questions without leaving the operations portal.</p></div><button className="admin-btn success" onClick={() => startEdit()}>+ Add New Question</button></div>
    <div className="admin-filter-card"><select className="admin-select" value={filters.exam_type} onChange={(e) => setFilters({ ...filters, exam_type: e.target.value })}><option>JAMB</option><option>WAEC</option><option>POST-UTME</option><option>NECO</option></select><select className="admin-select" value={filters.subject} onChange={(e) => setFilters({ ...filters, subject: e.target.value })}><option>Use of English</option><option>Mathematics</option><option>Physics</option><option>Chemistry</option><option>Biology</option></select><select className="admin-select" value={filters.exam_year} onChange={(e) => setFilters({ ...filters, exam_year: e.target.value })}><option>2026</option><option>2025</option><option>2024</option></select><span className="admin-filter-count">{questions.length} questions loaded</span></div>
    {openForm && <form className="admin-card admin-question-form" onSubmit={save}><div className="admin-card-header"><h2>{editing ? 'Edit Question' : 'Add New Question'}</h2><button type="button" className="admin-text-btn" onClick={() => setOpenForm(false)}>Close</button></div><textarea className="admin-textarea" placeholder="Question text" value={form.question_text} onChange={(e) => setForm({ ...form, question_text: e.target.value })} required /> <div className="admin-option-grid">{(['a','b','c','d'] as const).map((letter) => <input key={letter} className="admin-input" placeholder={`Option ${letter.toUpperCase()}`} value={form[`option_${letter}`]} onChange={(e) => setForm({ ...form, [`option_${letter}`]: e.target.value })} required />)}</div><div className="admin-inline-form"><select className="admin-select" value={form.correct_option} onChange={(e) => setForm({ ...form, correct_option: e.target.value })}><option>A</option><option>B</option><option>C</option><option>D</option></select><input className="admin-input" value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} placeholder="Explanation (optional)" /></div><button className="admin-btn" type="submit">Save Question</button></form>}
    <div className="admin-list">{questions.map((q, i) => <div className="admin-card admin-question-card" key={q.id}><div className="admin-question-top"><span className="question-tag">Question #{i + 1}</span><div><button className="admin-text-btn" onClick={() => startEdit(q)}>Edit</button><button className="admin-text-btn danger-text" onClick={() => remove(q.id)}>Archive</button></div></div><h3>{q.question_text}</h3><div className="admin-options"><div>A. {q.option_a}</div><div>B. {q.option_b}</div><div>C. {q.option_c}</div><div>D. {q.option_d}</div></div><small>Correct: <b>{q.correct_option}</b> · {q.status}</small></div>)}{!questions.length && <div className="admin-card empty-state">No questions loaded for this filter.</div>}</div>
  </div></AdminLayout>;
}
