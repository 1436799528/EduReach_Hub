import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, ChevronDown, Download, Printer, RotateCcw, XCircle } from 'lucide-react';
import HubLayout from '../src/components/HubLayout';
import CbtResultSlip from '../src/components/CbtResultSlip';
import { fetchCbtResult } from '../src/lib/api';
import { localStorageKey } from '../src/lib/localPreview';
import { isSupabaseConfigured, supabase } from '../src/lib/supabase';
import { useAuth } from '../src/lib/auth';

function navigateInApp(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

const slipDownloadCss = `
*{box-sizing:border-box}body{margin:0;background:#eef2f6;color:#172033;font-family:Arial,Helvetica,sans-serif}.er-result-slip{max-width:820px;margin:24px auto;background:#fff;border:1px solid #d8dee8;padding:34px;color:#172033}.er-result-slip-header{display:flex;justify-content:space-between;gap:24px;align-items:center}.er-result-brand{display:flex;align-items:center;gap:12px}.er-result-brand strong{display:block;font-size:24px}.er-result-brand span,.er-result-title-block span,.er-result-student-grid span,.er-result-signature-box span,.er-result-verification-box span{display:block;color:#667085;font-size:11px}.er-result-title-block{text-align:right}.er-result-title-block h2{margin:4px 0 0;font-size:20px}.er-result-rule{height:3px;background:#c85841;margin:24px 0}.er-result-student-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;border-bottom:1px solid #e4e7ec;padding-bottom:20px}.er-result-student-grid strong{display:block;margin-top:4px;font-size:13px}.er-result-performance{margin-top:22px}.er-result-section-heading{display:flex;justify-content:space-between;align-items:baseline}.er-result-section-heading h3{margin:0;font-size:16px}.er-result-section-heading span{font-size:12px;color:#047857}.er-result-subject-table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px}.er-result-subject-table th,.er-result-subject-table td{text-align:left;padding:10px;border-bottom:1px solid #e4e7ec}.er-result-subject-table th:not(:first-child),.er-result-subject-table td:not(:first-child){text-align:right}.er-result-total-row{display:flex;justify-content:space-between;padding:16px 0;border-bottom:1px solid #e4e7ec;font-size:17px}.er-result-total-row strong{color:#047857}.er-result-counts{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:12px;font-size:11px;color:#667085}.er-result-counts b{display:block;color:#172033;font-size:12px;margin-top:3px}.er-result-slip-footer{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:30px}.er-result-signature-box,.er-result-verification-box{border-top:1px solid #98a2b3;padding-top:9px}.er-result-signature-line{height:34px}.er-result-verification-box strong{display:block;margin-top:8px;letter-spacing:.08em;font-size:14px}.er-result-disclaimer{margin:26px 0 0;color:#667085;font-size:10px;line-height:1.5}@media(max-width:640px){.er-result-slip{margin:0;padding:22px}.er-result-slip-header{display:block}.er-result-title-block{text-align:left;margin-top:20px}.er-result-student-grid{grid-template-columns:repeat(2,1fr)}.er-result-counts{grid-template-columns:repeat(2,1fr)}}
`;

export default function CbtResultsPage({ attemptId: routeAttemptId }: { attemptId?: string } = {}) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);
  const [studentName, setStudentName] = useState('Guest student');
  const [studentId, setStudentId] = useState('');
  const [showReview, setShowReview] = useState(false);

  useEffect(() => {
    const attemptId = routeAttemptId || new URLSearchParams(window.location.search).get('attempt') || localStorage.getItem(localStorageKey('last-cbt-attempt')) || '';
    if (!attemptId) {
      setError('No CBT attempt was selected. Complete a practice test to generate a result.');
      setLoading(false);
      return;
    }

    void fetchCbtResult(attemptId)
      .then(setResult)
      .catch((value) => setError(value instanceof Error ? value.message : 'Unable to load the CBT result.'))
      .finally(() => setLoading(false));
  }, [routeAttemptId]);

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

  const score = Number(result?.attempt?.score || 0);
  const isPass = score >= 60;
  const correctCount = Number(result?.attempt?.correct_answers || 0);
  const totalCount = Number(result?.attempt?.total_questions || result?.questions?.length || 0);
  const missedCount = Math.max(0, totalCount - correctCount);

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

  return (
    <HubLayout>
      <div className="hub-page er-results-page">
        <div className="hub-container er-results-container">
          {loading && <div className="hub-panel hub-empty"><p>Loading your CBT result…</p></div>}

          {!loading && error && (
            <div className="hub-panel hub-empty">
              <h1>CBT result unavailable</h1>
              <p>{error}</p>
              <a className="hub-primary-btn" href="/cbt">Choose a CBT test</a>
            </div>
          )}

          {!loading && result && (
            <>
              <section className={`er-result-status ${isPass ? 'is-pass' : 'is-fail'}`} aria-labelledby="result-status-heading">
                <div className="er-result-status-icon">{isPass ? <CheckCircle2 size={30} /> : <XCircle size={30} />}</div>
                <div>
                  <span className="er-result-status-kicker">CBT test completed</span>
                  <h1 id="result-status-heading">{isPass ? 'Passed' : 'Completed — keep practising'}</h1>
                  <p>Score: <strong>{score.toFixed(1)}%</strong> · {isPass ? 'Good performance.' : 'You did not meet the 60% practice target.'}</p>
                </div>
              </section>

              <div className="er-result-actions" aria-label="Result actions">
                <button type="button" className="hub-primary-btn" onClick={printResult}><Printer size={15} /> Print Result</button>
                <button type="button" className="hub-outline-btn" onClick={downloadResult}><Download size={15} /> Download Result</button>
                <button type="button" className="hub-outline-btn" onClick={() => setShowReview((open) => !open)}><ChevronDown size={15} /> {showReview ? 'Hide Answers' : 'Review Answers'}</button>
                <a className="hub-outline-btn" href="/cbt"><RotateCcw size={15} /> Take Another Test</a>
                <button type="button" className="hub-text-btn er-result-return" onClick={() => navigateInApp('/cbt') }><ArrowLeft size={15} /> Return to CBT</button>
              </div>

              <CbtResultSlip result={result} studentName={studentName} studentId={studentId} />

              <section className="er-result-quick-stats" aria-label="Score details">
                <div><span>Correct</span><strong>{correctCount}</strong></div>
                <div><span>Incorrect</span><strong>{missedCount}</strong></div>
                <div><span>Total questions</span><strong>{totalCount}</strong></div>
                <div><span>Reference</span><strong>{result.attempt?.id || '—'}</strong></div>
              </section>

              {showReview && (
                <section className="er-result-review" aria-labelledby="review-heading">
                  <h2 id="review-heading">Review answers</h2>
                  <p className="er-result-review-intro">Use the corrections below to prepare for your next test.</p>
                  <div className="er-result-review-list">
                    {(result.questions || []).map((question: any) => {
                      const answer = (result.answers || []).find((item: any) => item.question_id === question.id);
                      const selectedIndex = answer?.selected_option ? String(answer.selected_option).charCodeAt(0) - 65 : null;
                      const correctIndex = String(question.correct_option || 'A').charCodeAt(0) - 65;
                      const options = [question.option_a, question.option_b, question.option_c, question.option_d];
                      return (
                        <article className={`er-result-review-card ${answer?.is_correct ? 'is-correct' : 'is-wrong'}`} key={question.id}>
                          <div className="er-result-review-head"><strong>Question {question.position}</strong><span>{answer?.is_correct ? 'Correct' : 'Review this answer'}</span></div>
                          <h3>{question.question_text}</h3>
                          <div className="er-result-review-options">
                            {options.map((option: string, index: number) => <div className={`${index === correctIndex ? 'is-answer' : ''} ${index === selectedIndex && index !== correctIndex ? 'is-selected-wrong' : ''}`} key={index}><b>{String.fromCharCode(65 + index)}.</b> {option}</div>)}
                          </div>
                          {question.explanation && <p><strong>Explanation:</strong> {question.explanation}</p>}
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
    </HubLayout>
  );
}
