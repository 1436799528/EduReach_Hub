import { FormEvent, useEffect, useState } from 'react';
import { adminApiFetch, deleteAdminCbtExam, updateAdminCbtExam, type AdminCbtExam } from '../src/lib/api';

type Exam = AdminCbtExam;
type Question = { id: string; exam_id: string; question_text: string; option_a: string; option_b: string; option_c: string; option_d: string; correct_option: 'A'|'B'|'C'|'D'; explanation: string | null; marks: number; position: number };
const emptyExam = { title: '', exam_body: 'JAMB', subject: 'Use of English', description: '', duration_minutes: '30', is_active: true };
const emptyQuestion: { question_text: string; option_a: string; option_b: string; option_c: string; option_d: string; correct_option: 'A'|'B'|'C'|'D'; explanation: string; marks: string; position: string } = { question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_option: 'A', explanation: '', marks: '1', position: '1' };

type ExamForm = { title: string; exam_body: string; subject: string; description: string; duration_minutes: string; is_active: boolean };

export default function AdminCbtPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [examForm, setExamForm] = useState(emptyExam);
  const [editingExam, setEditingExam] = useState<ExamForm | null>(null);
  const [questionForm, setQuestionForm] = useState(emptyQuestion);
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null);
  const [showExamForm, setShowExamForm] = useState(false);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function loadExams() {
    const body = await adminApiFetch<{ items: Exam[] }>('/api/admin/cbt/exams');
    setExams(body.items || []);
    setSelectedExam((current) => current || body.items?.[0]?.id || '');
  }
  async function loadQuestions(examId: string) {
    if (!examId) { setQuestions([]); return; }
    const body = await adminApiFetch<{ items: Question[] }>(`/api/admin/cbt/exams/${encodeURIComponent(examId)}/questions`);
    setQuestions(body.items || []);
  }
  useEffect(() => { void loadExams().catch((e) => setMessage(e.message)).finally(() => setLoading(false)); }, []);
  useEffect(() => { void loadQuestions(selectedExam).catch((e) => setMessage(e.message)); }, [selectedExam]);

  async function saveExam(event: FormEvent) {
    event.preventDefault(); setSaving(true); setMessage('');
    try {
      const body = await adminApiFetch<{ item: Exam }>('/api/admin/cbt/exams', { method: 'POST', body: JSON.stringify({ ...examForm, duration_minutes: Number(examForm.duration_minutes) }) });
      setExams((items) => [body.item, ...items]); setSelectedExam(body.item.id); setExamForm(emptyExam); setShowExamForm(false);
      setMessage('Exam created. Add its approved questions below — they become the live question pool immediately.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to save exam.'); } finally { setSaving(false); }
  }

  function openEditExam(exam: Exam) {
    setEditingExam({
      title: exam.title,
      exam_body: exam.exam_body,
      subject: exam.subject,
      description: exam.description || '',
      duration_minutes: String(exam.duration_minutes),
      is_active: exam.is_active,
    });
  }

  async function saveEditExam(event: FormEvent) {
    event.preventDefault();
    if (!selectedExam || !editingExam) return;
    setSaving(true); setMessage('');
    try {
      const updated = await updateAdminCbtExam(selectedExam, {
        title: editingExam.title.trim(),
        exam_body: editingExam.exam_body.trim(),
        subject: editingExam.subject.trim(),
        description: editingExam.description.trim(),
        duration_minutes: Number(editingExam.duration_minutes),
        is_active: editingExam.is_active,
      });
      setExams((items) => items.map((item) => item.id === updated.id ? { ...item, ...updated } : item));
      setEditingExam(null);
      setMessage('Exam configuration updated — the public setup page now shows this default duration.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to update the exam.');
    } finally { setSaving(false); }
  }

  async function toggleExamActive(exam: Exam) {
    setMessage('');
    try {
      const updated = await updateAdminCbtExam(exam.id, { is_active: !exam.is_active });
      setExams((items) => items.map((item) => item.id === updated.id ? { ...item, ...updated } : item));
      setMessage(updated.is_active ? `“${updated.title}” is live on the CBT page.` : `“${updated.title}” is hidden from students.`);
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to update the exam.'); }
  }

  async function removeExam(exam: Exam) {
    if (!window.confirm(`Delete “${exam.title}” and all of its questions? Exams with student attempts cannot be deleted — deactivate them instead.`)) return;
    setMessage('');
    try {
      await deleteAdminCbtExam(exam.id);
      setExams((items) => items.filter((item) => item.id !== exam.id));
      if (selectedExam === exam.id) { setSelectedExam(''); setQuestions([]); }
      setMessage('Exam deleted.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to delete the exam.'); }
  }

  function startQuestion(question?: Question) {
    if (!question) { setEditingQuestion(null); setQuestionForm({ ...emptyQuestion, position: String(questions.length + 1) }); }
    else { setEditingQuestion(question.id); setQuestionForm({ question_text: question.question_text, option_a: question.option_a, option_b: question.option_b, option_c: question.option_c, option_d: question.option_d, correct_option: question.correct_option, explanation: question.explanation || '', marks: String(question.marks), position: String(question.position) }); }
    setShowQuestionForm(true);
  }

  async function saveQuestion(event: FormEvent) {
    event.preventDefault(); if (!selectedExam) return; setSaving(true); setMessage('');
    try {
      const payload = { ...questionForm, marks: Number(questionForm.marks), position: Number(questionForm.position) };
      const body = editingQuestion
        ? await adminApiFetch<{ item: Question }>(`/api/admin/cbt/questions/${encodeURIComponent(editingQuestion)}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : await adminApiFetch<{ item: Question }>(`/api/admin/cbt/exams/${encodeURIComponent(selectedExam)}/questions`, { method: 'POST', body: JSON.stringify(payload) });
      setQuestions((items) => editingQuestion ? items.map((q) => q.id === editingQuestion ? body.item : q) : [...items, body.item].sort((a,b) => a.position-b.position));
      setShowQuestionForm(false); setEditingQuestion(null); setQuestionForm(emptyQuestion); setMessage('Question saved.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to save question.'); } finally { setSaving(false); }
  }

  async function archiveQuestion(id: string) {
    if (!window.confirm('Remove this question from the exam?')) return;
    try { await adminApiFetch(`/api/admin/cbt/questions/${encodeURIComponent(id)}`, { method: 'DELETE' }); setQuestions((items) => items.filter((q) => q.id !== id)); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to remove question.'); }
  }

  const exam = exams.find((item) => item.id === selectedExam);
  return <div className="admin-page">
    <div className="admin-page-header"><div><h1>CBT Exam Manager</h1><p>Manage the production CBT engine: exams, default durations, active state, question pools, answer keys and explanations. Public CBT cards read this catalogue directly — no duration or question is hard-coded on the site.</p></div><button type="button" className="admin-btn success" onClick={() => setShowExamForm(true)}>+ New Exam</button></div>
    {message && <div className="admin-card">{message}</div>}
    {showExamForm && <form className="admin-card admin-question-form" onSubmit={saveExam}><div className="admin-card-header"><h2>Create Exam</h2><button type="button" className="admin-text-btn" onClick={() => setShowExamForm(false)}>Close</button></div><div className="admin-inline-form"><input className="admin-input" aria-label="Exam title" placeholder="Exam title" value={examForm.title} onChange={e=>setExamForm({...examForm,title:e.target.value})} required/><select aria-label="Exam body" className="admin-select" value={examForm.exam_body} onChange={e=>setExamForm({...examForm,exam_body:e.target.value})}><option>JAMB</option><option>WAEC</option><option>NECO</option><option>POST-UTME</option><option>EduReach</option></select><input className="admin-input" aria-label="Exam subject" placeholder="Subject (e.g. Use of English)" value={examForm.subject} onChange={e=>setExamForm({...examForm,subject:e.target.value})} required/><input className="admin-input" aria-label="Default duration in minutes" type="number" min="5" max="180" value={examForm.duration_minutes} onChange={e=>setExamForm({...examForm,duration_minutes:e.target.value})}/></div><textarea className="admin-textarea" aria-label="Exam description" placeholder="Short description shown on the question-bank card" value={examForm.description} onChange={e=>setExamForm({...examForm,description:e.target.value})}/><button type="submit" className="admin-btn" disabled={saving}>{saving ? 'Saving…' : 'Create Exam'}</button></form>}
    <div className="admin-filter-card"><select aria-label="Select exam" className="admin-select" value={selectedExam} onChange={e=>{setSelectedExam(e.target.value); setEditingExam(null);}}><option value="">Select an exam</option>{exams.map(e=><option key={e.id} value={e.id}>{e.exam_body} · {e.subject} · {e.title}{e.is_active ? '' : ' (inactive)'}</option>)}</select>{exam && <span className="admin-filter-count">Default time: {exam.duration_minutes} minutes · {questions.length} questions · {exam.is_active ? 'live' : 'hidden'}</span>}</div>
    {selectedExam && exam && !editingExam && <div className="admin-page-header"><div><h2>{exam.title}</h2><p>{exam.description || 'No description.'}</p></div><div className="admin-header-actions"><button type="button" className="admin-btn secondary-dark" onClick={()=>openEditExam(exam)}>Edit exam</button><button type="button" className="admin-btn secondary-dark" onClick={()=>void toggleExamActive(exam)}>{exam.is_active ? 'Deactivate' : 'Activate'}</button><button type="button" className="admin-btn secondary-dark" onClick={()=>void removeExam(exam)}>Delete</button><button type="button" className="admin-btn" onClick={()=>startQuestion()}>+ Add Question</button></div></div>}
    {selectedExam && exam && editingExam && <form className="admin-card admin-question-form" onSubmit={saveEditExam}><div className="admin-card-header"><h2>Edit exam configuration</h2><button type="button" className="admin-text-btn" onClick={()=>setEditingExam(null)}>Cancel</button></div><div className="admin-inline-form"><input className="admin-input" aria-label="Exam title" value={editingExam.title} onChange={e=>setEditingExam({...editingExam,title:e.target.value})} required/><select aria-label="Exam body" className="admin-select" value={editingExam.exam_body} onChange={e=>setEditingExam({...editingExam,exam_body:e.target.value})}><option>JAMB</option><option>WAEC</option><option>NECO</option><option>POST-UTME</option><option>EDUREACH</option></select><input className="admin-input" aria-label="Exam subject" value={editingExam.subject} onChange={e=>setEditingExam({...editingExam,subject:e.target.value})} required/><input className="admin-input" aria-label="Default duration in minutes" type="number" min="5" max="180" value={editingExam.duration_minutes} onChange={e=>setEditingExam({...editingExam,duration_minutes:e.target.value})}/></div><textarea className="admin-textarea" aria-label="Exam description" value={editingExam.description} onChange={e=>setEditingExam({...editingExam,description:e.target.value})}/><label className="admin-check-row" style={{margin:'8px 0'}}><input type="checkbox" checked={editingExam.is_active} onChange={e=>setEditingExam({...editingExam,is_active:e.target.checked})}/> Active (visible to students)</label><p className="admin-quality-gate">Default duration is the single source of truth for this exam's time: the setup page shows it, and students may only choose durations up to this value. The countdown itself starts inside the CBT hall.</p><button type="submit" className="admin-btn" disabled={saving}>{saving ? 'Saving…' : 'Save exam configuration'}</button></form>}
    {showQuestionForm && <form className="admin-card admin-question-form" onSubmit={saveQuestion}><div className="admin-card-header"><h2>{editingQuestion ? 'Edit Question' : 'Add Question'}</h2><button type="button" className="admin-text-btn" onClick={()=>setShowQuestionForm(false)}>Close</button></div><textarea className="admin-textarea" aria-label="Question text" placeholder="Question text" value={questionForm.question_text} onChange={e=>setQuestionForm({...questionForm,question_text:e.target.value})} required/><div className="admin-option-grid">{(['a','b','c','d'] as const).map(letter=><input key={letter} className="admin-input" aria-label={`Option ${letter.toUpperCase()}`} placeholder={`Option ${letter.toUpperCase()}`} value={questionForm[`option_${letter}`]} onChange={e=>setQuestionForm({...questionForm,[`option_${letter}`]:e.target.value})} required/>)}</div><div className="admin-inline-form"><select aria-label="Correct answer option" className="admin-select" value={questionForm.correct_option} onChange={e=>setQuestionForm({...questionForm,correct_option:e.target.value as 'A'|'B'|'C'|'D'})}><option>A</option><option>B</option><option>C</option><option>D</option></select><input className="admin-input" aria-label="Question marks" type="number" min="1" value={questionForm.marks} onChange={e=>setQuestionForm({...questionForm,marks:e.target.value})}/><input className="admin-input" aria-label="Question position" type="number" min="1" value={questionForm.position} onChange={e=>setQuestionForm({...questionForm,position:e.target.value})}/></div><input className="admin-input" aria-label="Question explanation" placeholder="Explanation (optional)" value={questionForm.explanation} onChange={e=>setQuestionForm({...questionForm,explanation:e.target.value})}/><button type="submit" className="admin-btn" disabled={saving}>{saving ? 'Saving…' : 'Save Question'}</button></form>}
    {loading ? <div className="admin-card empty-state">Loading CBT exams…</div> : !exams.length ? <div className="admin-card empty-state">No CBT exams have been created. Create the first exam and add its approved questions — the public CBT page stays honestly empty until then.</div> : selectedExam && <div className="admin-list">{questions.map((q,i)=><div className="admin-card admin-question-card" key={q.id}><div className="admin-question-top"><span className="question-tag">Question {q.position}</span><div><button type="button" className="admin-text-btn" onClick={()=>startQuestion(q)}>Edit</button><button type="button" className="admin-text-btn danger-text" onClick={()=>void archiveQuestion(q.id)}>Remove</button></div></div><h3>{q.question_text}</h3><div className="admin-options"><div>A. {q.option_a}</div><div>B. {q.option_b}</div><div>C. {q.option_c}</div><div>D. {q.option_d}</div></div><small>Correct: <b>{q.correct_option}</b> · {q.marks} mark{q.marks === 1 ? '' : 's'}</small></div>)}{!questions.length && <div className="admin-card empty-state">No questions in this exam yet. Students see an honest “no questions yet” state until approved questions are added here.</div>}</div>}
  </div>;
}
