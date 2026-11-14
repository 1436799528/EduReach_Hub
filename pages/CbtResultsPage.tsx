import { userFacingError } from '../lib/errors';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Download, Printer, RotateCcw, Trash2, X } from 'lucide-react';
import HubLayout from '../src/components/HubLayout';
import CbtResultSlip from '../src/components/CbtResultSlip';
import { deleteCbtAttempt, fetchCbtResult, type CbtResultPayload, type CbtResultQuestion, type CbtResultAnswer } from '../src/lib/api';
import { LoadingState, ErrorState, InlineNotice } from '../src/components/AsyncState';
import { localStorageKey } from '../src/lib/localPreview';
import { isSupabaseConfigured, supabase } from '../src/lib/supabase';
import { useAuth } from '../src/lib/auth';
import { navigateInApp } from '../src/lib/navigation';
import './CbtResultsPage.css';

const slipDownloadCss = `
*{box-sizing:border-box}body{margin:0;background:#eef2f6;color:#172033;font-family:Arial,Helvetica,sans-serif}.er-result-slip{max-width:820px;margin:24px auto;background:#fff;border:1px solid #d8dee8;padding:34px;color:#172033}.er-result-slip-header{display:flex;justify-content:space-between;gap:24px;align-items:center}.er-result-brand{display:flex;align-items:center;gap:12px}.er-result-brand strong{display:block;font-size:24px}.er-result-brand span,.er-result-title-block span,.er-result-student-grid span,.er-result-signature-box span,.er-result-verification-box span{display:block;color:#667085;font-size:11px}.er-result-title-block{text-align:right}.er-result-title-block h2{margin:4px 0 0;font-size:20px}.er-result-rule{height:3px;background:#b14933;margin:24px 0}.er-result-student-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;border-bottom:1px solid #e4e7ec;padding-bottom:20px}.er-result-student-grid strong{display:block;margin-top:4px;font-size:13px}.er-result-performance{margin-top:22px}.er-result-section-heading{display:flex;justify-content:space-between;align-items:baseline}.er-result-section-heading h3{margin:0;font-size:16px}.er-result-section-heading span{font-size:12px;color:#047857}.er-result-subject-table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px}.er-result-subject-table th,.er-result-subject-table td{text-align:left;padding:10px;border-bottom:1px solid #e4e7ec}.er-result-subject-table th:not(:first-child),.er-result-subject-table td:not(:first-child){text-align:right}.er-result-total-row{display:flex;justify-content:space-between;padding:16px 0;border-bottom:1px solid #e4e7ec;font-size:17px}.er-result-total-row strong{color:#047857}.er-result-counts{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:12px;font-size:11px;color:#667085}.er-result-counts b{display:block;color:#172033;font-size:12px;margin-top:3px}.er-result-slip-footer{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:30px}.er-result-signature-box,.er-result-verification-box{border-top:1px solid #98a2b3;padding-top:9px}.er-result-signature-line{height:34px}.er-result-verification-box strong{display:block;margin-top:8px;letter-spacing:.08em;font-size:14px}.er-result-disclaimer{margin:26px 0 0;color:#667085;font-size:10px;line-height:1.5}@media(max-width:640px){.er-result-slip{margin:0;padding:22px}.er-result-slip-header{display:block}.er-result-title-block{text-align:left;margin-top:20px}.er-result-student-grid{grid-template-columns:repeat(2,1fr)}.er-result-counts{grid-template-columns:repeat(2,1fr)}}
`;

export default function CbtResultsPage({ attemptId: routeAttemptId }: { attemptId?: string } = {}) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CbtResultPayload | null>(null);
  const [studentName, setStudentName] = useState('Guest student');
  const [studentId, setStudentId] = useState('');
  const [showReview, setShowReview] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteSuccess, setDeleteSuccess] = useState('');
  const deleteDialog = useRef<HTMLDialogElement | null>(null);

  const loadResult = () => {
    const attemptId = routeAttemptId || new URLSearchParams(window.location.search).get('attempt') || localStorage.getItem(localStorageKey('last-cbt-attempt')) || '';
    if (!attemptId) {
      setError('No CBT attempt was selected. Complete a practice test to generate a result.');
      setLoading(false);
      return;
    }
    setError('');
    setLoading(true);
    void fetchCbtResult(attemptId)
      .then(setResult)
      .catch((value) => setError(userFacingError(value, 'Unable to load the CBT result.')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadResult();
  }, [routeAttemptId]);

  useEffect(() => {
    if (confirmDelete && deleteDialog.current && !deleteDialog.current.open) deleteDialog.current.showModal();
  }, [confirmDelete]);

  async function removeResult() {
    const attemptId = String(result?.attempt?.id || routeAttemptId || '');
    if (!attemptId) return;
    setDeleteBusy(true);
    setDeleteError('');
    setDeleteSuccess('');
    try {
      await deleteCbtAttempt(attemptId);
      setConfirmDelete(false);
      deleteDialog.current?.close();
      setDeleteSuccess('Deleted this CBT result. It is no longer on your account. Start a new practice test from the CBT Centre.');
    } catch (value) {
      setDeleteError(userFacingError(value, 'This result could not be deleted.'));
    } finally {
      setDeleteBusy(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    setStudentName(user.name || 'Student');
    setStudentId(user.email || user.id || '');
    if (!isSupabaseConfigured || user.isLocal) return;
    void supabase.from('profiles').select('full_name,matric_number,jamb_reg_no').eq('id', user.id).maybeSingle().then(({ data }) => {
      if (data?.full_name) setStudentName(data.full_name);
      if (data?.matric_number || data?.jamb_reg_no) setStudentId(data.matric_number || data.jamb_reg_no || studentId);
    });
  }, [user]);

  const questions: CbtResultQuestion[] = result?.questions ?? [];
  const answers: CbtResultAnswer[] = result?.answers ?? [];

  const subjectRows = (() => {
    if (!questions.some((question) => question.subject)) {
      return [] as Array<{ subject: string; correct: number; total: number }>;
    }
    const map = new Map<string, { subject: string; correct: number; total: number }>();
    for (const question of questions) {
      const key = String(question.subject || 'General');
      const entry = map.get(key) || { subject: key, correct: 0, total: 0 };
      entry.total += 1;
      if (answers.find((answer) => answer.question_id === question.id)?.is_correct) entry.correct += 1;
      map.set(key, entry);
    }
    return Array.from(map.values());
  })();

  const storedScore = Number(result?.attempt?.score || 0);
  const examBody = String(result?.exam?.exam_body || '').trim().toUpperCase();
  const isWaecStyle = examBody === 'WAEC' || examBody === 'NECO';
  const isJambStyle = examBody === 'JAMB' || examBody === 'UTME' || examBody.includes('POST');
  const subjectMarkTotal = subjectRows.reduce((sum, row) => sum + (row.total > 0 ? (row.correct / row.total) * 100 : 0), 0);
  const score = isJambStyle && subjectRows.length
    ? Math.round(subjectMarkTotal)
    : storedScore;
  const markMaximum = isJambStyle && subjectRows.length ? subjectRows.length * 100 : 100;
  const waecGrade = (correct: number, total: number) => {
    const percent = total > 0 ? (correct / total) * 100 : 0;
    if (percent >= 75) return { grade: 'A1', remark: 'Excellent' };
    if (percent >= 70) return { grade: 'B2', remark: 'Very Good' };
    if (percent >= 65) return { grade: 'B3', remark: 'Good' };
    if (percent >= 60) return { grade: 'C4', remark: 'Credit' };
    if (percent >= 55) return { grade: 'C5', remark: 'Credit' };
    if (percent >= 50) return { grade: 'C6', remark: 'Credit' };
    if (percent >= 45) return { grade: 'D7', remark: 'Pass' };
    if (percent >= 40) return { grade: 'E8', remark: 'Pass' };
    return { grade: 'F9', remark: 'Fail' };
  };
  const correctCount = Number(result?.attempt?.correct_answers || 0);
  const totalCount = Number(result?.attempt?.total_questions || questions.length || 0);

  // Unanswered questions are not wrong answers. Count what the paper actually
  // recorded; when the attempt carries no answer detail (a saved score only),
  // show "-" rather than inventing a split.
  const answeredCount = answers.filter((answer) => answer.selected_option !== null && answer.selected_option !== undefined).length;
  const hasAnswerDetail = answers.length > 0;
  const wrongCount = hasAnswerDetail ? Math.max(0, answeredCount - correctCount) : null;
  const unansweredCount = hasAnswerDetail ? Math.max(0, totalCount - answeredCount) : null;

  const printResult = () => window.print();
  const downloadResult = () => {
    const slip = document.getElementById('er-result-slip');
    if (!slip) return;
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>EduReach CBT Result</title><style>${slipDownloadCss}</style></head><body>${slip.outerHTML}</body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `edureach-cbt-result-${result?.attempt?.id || 'record'}.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const displayPercent = isJambStyle && subjectRows.length
    ? Math.round((score / Math.max(1, markMaximum)) * 100)
    : Math.round((correctCount / Math.max(1, totalCount)) * 100);
  const resultBand = displayPercent >= 70
    ? { title: 'A strong result', detail: 'Keep the same paper pattern and protect the time you used.' }
    : displayPercent >= 50
      ? { title: 'A fair result', detail: 'The paper found gaps worth practising before the next full attempt.' }
      : { title: 'Room to improve', detail: 'Use the subject breakdown below to choose a smaller paper next.' };
  const scoredSubjects = subjectRows
    .filter((row) => row.total > 0)
    .map((row) => ({ ...row, percent: Math.round((row.correct / row.total) * 100) }));
  const subjectSpread = new Set(scoredSubjects.map((row) => row.percent)).size > 1;
  const weakestSubject = scoredSubjects.length > 1 && subjectSpread
    ? scoredSubjects.reduce((lowest, row) => (row.percent < lowest.percent ? row : lowest), scoredSubjects[0])
    : null;
  const strongestSubject = scoredSubjects.length > 1 && subjectSpread
    ? scoredSubjects.reduce((best, row) => (row.percent > best.percent ? row : best), scoredSubjects[0])
    : null;

  const timeUsed = result?.attempt?.duration_minutes
    ? `${result.attempt.duration_minutes} minutes`
    : (result?.attempt?.started_at && result?.attempt?.submitted_at
      ? (() => {
          const ms = Math.max(0, new Date(result.attempt.submitted_at).getTime() - new Date(result.attempt.started_at).getTime());
          const mins = Math.round(ms / 60000);
          return `${mins} minute${mins === 1 ? '' : 's'}`;
        })()
      : 'Not recorded');

  return (
    <HubLayout>
      <div className="hub-page er-results-page">
        <div className="hub-container er-results-container">
          {loading && (
            <LoadingState
              label="Loading your CBT result"
              detail="Fetching your saved attempt and answers."
              compact
            />
          )}

          {!loading && error && (
            <>
              {/* Direct routes must always render a heading: this page previously
                  lost its h1 to the shared ErrorState, and the e2e contract
                  (every public route renders an h1) caught it on main. */}
              <h1>CBT result unavailable</h1>
              <ErrorState
                error={error}
                onRetry={loadResult}
                action={<a className="hub-primary-btn" href="/cbt">Back to CBT</a>}
              />
            </>
          )}

          {deleteSuccess && (
            <InlineNotice tone="success" title="Result deleted">
              {deleteSuccess}
            </InlineNotice>
          )}

          {!loading && result && !deleteSuccess && (
            <>
              <section className="er-result-header" aria-labelledby="result-heading">
                <div className="er-result-hero">
                  <div className="er-result-ring" role="img" aria-label={`${displayPercent} percent in this paper`}>
                    <svg viewBox="0 0 120 120" aria-hidden="true">
                      <circle className="er-result-ring-track" cx="60" cy="60" r="52" pathLength="100" />
                      <circle className="er-result-ring-value" cx="60" cy="60" r="52" pathLength="100" strokeDasharray={`${displayPercent} 100`} />
                    </svg>
                    <span className="er-result-ring-label">{displayPercent}%</span>
                  </div>
                  <div className="er-result-hero-copy">
                    <span className="er-result-kicker">CBT result</span>
                    <h1 id="result-heading">{resultBand.title}</h1>
                    <p className="er-result-band-detail">{resultBand.detail}</p>
                    <p className="er-result-band-detail">
                      {correctCount} of {totalCount} question{totalCount === 1 ? '' : 's'} correct
                      {isWaecStyle ? ' · subject grades use estimated A1–F9 bands' : isJambStyle ? ` · total mark ${score}/${markMaximum} (estimated)` : ''}.
                    </p>
                    {!isWaecStyle && <div className="er-result-score">{isJambStyle ? score : Math.round((correctCount / Math.max(1, totalCount)) * 100)}<span>{`/${markMaximum}`}</span></div>}
                  </div>
                </div>
                {isWaecStyle && <p className="er-result-grade-note">Subject grades use estimated A1–F9 bands from this simulator's objective questions; official results may use subject-specific marking schemes.</p>}
                {isJambStyle && <p className="er-result-grade-note">Marks are estimated from subject-level correct-answer rates; official JAMB or institution scoring may differ.</p>}
              </section>

              <section className="er-result-counts-block" aria-label="Score summary">
                <div><span>Questions</span><strong>{totalCount}</strong></div>
                <div><span>Correct</span><strong className="is-correct">{correctCount}</strong></div>
                <div><span>Wrong</span><strong className="is-wrong">{wrongCount ?? '—'}</strong></div>
                <div><span>Unanswered</span><strong>{unansweredCount ?? '—'}</strong></div>
                <div><span>Time used</span><strong>{timeUsed}</strong></div>
              </section>

              {scoredSubjects.length > 0 && (
                <section className="er-result-guidance" aria-label="What this result means">
                  <div className="er-result-guidance-main">
                    <h2 className="er-result-section-title">What this means</h2>
                    {weakestSubject ? (
                      <p>
                        <strong>{weakestSubject.subject}</strong> was the lowest subject in this paper at <strong>{weakestSubject.percent}%</strong>.
                        {' '}A shorter {weakestSubject.subject} paper would give a clearer signal than repeating this paper immediately.
                        {strongestSubject && strongestSubject.subject !== weakestSubject.subject
                          ? ` ${strongestSubject.subject} was the strongest at ${strongestSubject.percent}%.`
                          : ''}
                      </p>
                    ) : scoredSubjects.length === 1 ? (
                      <p>
                        This paper covered <strong>{scoredSubjects[0].subject}</strong> only, so there is no subject comparison to make.
                        Add a second subject to see where to focus next.
                      </p>
                    ) : scoredSubjects.length > 1 && !subjectSpread ? (
                      <p>
                        No subject stood out in this paper — every subject scored <strong>{scoredSubjects[0].percent}%</strong>.
                        Use the answers below to decide which subject to revisit first.
                      </p>
                    ) : (
                      <p>Subject breakdown is unavailable for this attempt. The overall score is still recorded.</p>
                    )}
                  </div>
                  <div className="er-result-guidance-actions">
                    <a className="hub-primary-btn" href="/cbt"><RotateCcw size={15} /> Practise again</a>
                    <a className="hub-outline-btn" href="/dashboard/cbt">View My CBT <ArrowRight size={15} /></a>
                  </div>
                </section>
              )}

              {scoredSubjects.length > 0 && (
                <section className="er-result-subject-bars" aria-label="Subject comparison">
                  <h2 className="er-result-section-title">By subject</h2>
                  <ul>
                    {scoredSubjects.map((row) => (
                      <li key={row.subject}>
                        <div className="er-result-bar-head">
                          <span>{row.subject}</span>
                          <strong>{row.percent}%</strong>
                        </div>
                        <div
                          className="er-result-bar"
                          role="progressbar"
                          aria-label={`${row.subject}: ${row.percent} percent`}
                          aria-valuenow={row.percent}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <span style={{ width: `${row.percent}%` }} />
                        </div>
                        <span className="er-result-bar-meta">{row.correct} of {row.total} correct</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {subjectRows.length > 0 && (
                <section className="er-result-subject-table-wrap er-result-visible-subject-table" aria-label="Performance by subject">
                  <h2 className="er-result-section-title">Performance by subject</h2>
                  <table className="er-result-subject-table">
                    <thead>
                      <tr>
                        <th scope="col">Subject</th>
                        <th scope="col" className="num">Questions</th>
                        <th scope="col" className="num">Correct</th>
                        <th scope="col" className="num">Wrong</th>
                        <th scope="col" className="num">{isWaecStyle ? 'Grade' : 'Mark'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subjectRows.map((row) => {
                        const wrong = row.total - row.correct;
                        const pct = row.total ? Math.round((row.correct / row.total) * 100) : 0;
                        const grade = waecGrade(row.correct, row.total);
                        return (
                          <tr key={row.subject}>
                            <td>{row.subject}</td>
                            <td className="num">{row.total}</td>
                            <td className="num">{row.correct}</td>
                            <td className="num">{wrong}</td>
                            <td className="num"><b>{isWaecStyle ? grade.grade : `${pct} / 100`}</b>{isWaecStyle && <small className="er-result-grade-remark"> {grade.remark}</small>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <ul className="er-result-mobile-subjects" aria-label="Subject performance">
                    {subjectRows.map((row) => {
                      const wrong = row.total - row.correct;
                      const pct = row.total ? Math.round((row.correct / row.total) * 100) : 0;
                      const grade = waecGrade(row.correct, row.total);
                      return (
                        <li className="hub-panel" key={row.subject}>
                          <h3>{row.subject}</h3>
                          <dl>
                            <div><dt>Questions</dt><dd>{row.total}</dd></div>
                            <div><dt>Correct</dt><dd>{row.correct}</dd></div>
                            <div><dt>Wrong</dt><dd>{wrong}</dd></div>
                            <div><dt>{isWaecStyle ? 'Grade' : 'Mark'}</dt><dd><b>{isWaecStyle ? grade.grade : `${pct} / 100`}</b>{isWaecStyle && <small className="er-result-grade-remark"> {grade.remark}</small>}</dd></div>
                          </dl>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              <div
                aria-hidden="true"
                style={{ position: 'fixed', top: 0, left: '-10000px', width: 820, pointerEvents: 'none' }}
              >
                <CbtResultSlip
                  result={result}
                  studentName={studentName}
                  studentId={studentId}
                  subjectBreakdown={subjectRows.map((row) => ({
                    subject: row.subject,
                    questions: row.total,
                    correct: row.correct,
                    score: row.total ? (row.correct / row.total) * 100 : 0,
                  }))}
                />
              </div>

              <p className="er-result-review-intro">Your result is saved in CBT history. Leave it here to keep it, or use the trash button to remove it permanently.</p>
              <div className="er-result-actions" aria-label="Result actions">
                {(result.questions?.length ?? 0) > 0 ? (
                  <button type="button" className="hub-primary-btn" onClick={() => setShowReview((open) => !open)}>
                    {showReview ? 'Hide Answers' : 'Review Answers'}
                  </button>
                ) : (
                  <p role="status" className="er-result-review-intro">Your saved score is available. Answer-by-answer review is unavailable for this attempt.</p>
                )}
                <a className="hub-outline-btn" href="/cbt"><RotateCcw size={15} /> Try Again</a>
                <button type="button" className="hub-outline-btn" onClick={printResult}><Printer size={15} /> Print</button>
                <button type="button" className="hub-outline-btn" onClick={downloadResult}><Download size={15} /> Download</button>
                {result?.attempt?.id && (
                  <button
                    type="button"
                    className="er-result-delete"
                    aria-label="Delete"
                    title="Delete this result"
                    onClick={() => { setDeleteError(''); setConfirmDelete(true); }}
                  >
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                )}
                <button type="button" className="hub-text-btn er-result-return" onClick={() => navigateInApp('/cbt')}><ArrowLeft size={15} /> Back to CBT</button>
              </div>

              {showReview && (
                <section className="er-result-review" aria-labelledby="review-heading">
                  <h2 id="review-heading">Review answers</h2>
                  <p className="er-result-review-intro">Use the corrections below to prepare for your next test.</p>
                  <div className="er-result-review-list">
                    {questions.map((question) => {
                      const answer = answers.find((item) => item.question_id === question.id);
                      const selectedIndex = answer?.selected_option ? String(answer.selected_option).charCodeAt(0) - 65 : null;
                      // The key is released only for questions the student attempted,
                      // so `correct_option` can legitimately be null. A
                      // null must render as "not attempted" - falling back to 'A'
                      // would point at the wrong option.
                      const keyReleased = Boolean(question.correct_option);
                      const correctIndex = keyReleased ? String(question.correct_option).charCodeAt(0) - 65 : -1;
                      const options = [question.option_a, question.option_b, question.option_c, question.option_d];
                      return (
                        <article className={`er-result-review-card ${keyReleased ? (answer?.is_correct ? 'is-correct' : 'is-wrong') : ''}`} key={question.id}>
                          <div className="er-result-review-head"><strong>Question {question.position}{question.subject ? ` · ${question.subject}` : ''}</strong><span>{keyReleased ? (answer?.is_correct ? 'Correct' : 'Review this answer') : 'Not attempted'}</span></div>
                          <h3>{question.question_text}</h3>
                          <div className="er-result-review-options">
                            {options.map((option, index) => <div className={`${index === correctIndex ? 'is-answer' : ''} ${index === selectedIndex && index !== correctIndex ? 'is-selected-wrong' : ''}`} key={index}><b>{String.fromCharCode(65 + index)}.</b> {option ?? ''}</div>)}
                          </div>
                          {question.explanation && <p><strong>Explanation:</strong> {question.explanation}</p>}
                          {!keyReleased && <p>You did not attempt this question, so its answer is not shown.</p>}
                        </article>
                      );
                    })}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
      <dialog ref={deleteDialog} className="er-confirm" onClose={() => setConfirmDelete(false)} aria-labelledby="er-result-delete-title">
        <div className="er-confirm-body" style={{ position: 'relative' }}>
          <button type="button" aria-label="Close delete confirmation" title="Close" onClick={() => { setConfirmDelete(false); deleteDialog.current?.close(); }} disabled={deleteBusy} style={{ position: 'absolute', top: 8, right: 8, display: 'grid', placeItems: 'center', width: 34, height: 34, border: '1px solid #d8dee8', borderRadius: 8, background: '#fff', color: '#344054', cursor: 'pointer' }}><X size={18} /></button>
          <h2 id="er-result-delete-title" style={{ paddingRight: 36 }}>Delete this CBT result?</h2>
          <p>This will permanently remove this CBT result and its saved answers from your saved history. This cannot be undone.</p>
          {deleteError && <p role="alert" className="hub-form-error">{deleteError}</p>}
          <div className="er-confirm-actions">
            <button type="button" className="hub-outline-btn" onClick={() => { setConfirmDelete(false); deleteDialog.current?.close(); }}>Keep result</button>
            <button type="button" className="er-danger-btn" onClick={() => void removeResult()} disabled={deleteBusy}>{deleteBusy ? 'Deleting…' : 'Delete permanently'}</button>
          </div>
        </div>
      </dialog>
    </HubLayout>
  );
}
