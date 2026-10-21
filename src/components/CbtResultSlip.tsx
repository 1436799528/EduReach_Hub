import BrandLogo from './BrandLogo';
import { formatLongDate } from '../lib/dates';

type ResultQuestion = {
  position?: number;
  question_text?: string;
  correct_option?: string | null;
};

type ResultData = {
  attempt?: {
    id?: string;
    exam_id?: string;
    mode?: string;
    score?: number | string | null;
    correct_answers?: number | string | null;
    total_questions?: number | string | null;
    submitted_at?: string | null;
  };
  exam?: {
    title?: string | null;
    exam_body?: string | null;
    subject?: string | null;
    duration_minutes?: number | null;
  } | null;
  questions?: ResultQuestion[];
};

type SubjectBreakdown = { subject: string; questions: number; correct: number; score: number };

function gradeFor(score: number) {
  if (score >= 70) return { grade: 'A', remark: 'Excellent performance' };
  if (score >= 60) return { grade: 'B', remark: 'Good performance' };
  if (score >= 50) return { grade: 'C', remark: 'Fair performance' };
  if (score >= 40) return { grade: 'D', remark: 'Keep practising' };
  return { grade: 'E', remark: 'More practice is needed' };
}

export default function CbtResultSlip({ result, studentName, studentId, subjectBreakdown }: {
  result: ResultData;
  studentName: string;
  studentId: string;
  subjectBreakdown?: SubjectBreakdown[];
}) {
  const attempt = result.attempt || {};
  const score = Number(attempt.score || 0);
  const total = Number(attempt.total_questions || result.questions?.length || 0);
  const correct = Number(attempt.correct_answers || 0);
  const incorrect = Math.max(0, total - correct);
  const examBody = String(result.exam?.exam_body || '').toUpperCase();
  const isWaecStyle = examBody === 'WAEC' || examBody === 'NECO';
  const isJambStyle = examBody === 'JAMB' || examBody === 'UTME' || examBody.includes('POST');
  const isMock = String(attempt.mode || '').toLowerCase() === 'mock';
  const gradeForSubject = (item: SubjectBreakdown) => {
    const percent = item.questions > 0 ? (item.correct / item.questions) * 100 : 0;
    if (percent >= 75) return 'A1';
    if (percent >= 70) return 'B2';
    if (percent >= 65) return 'B3';
    if (percent >= 60) return 'C4';
    if (percent >= 55) return 'C5';
    if (percent >= 50) return 'C6';
    if (percent >= 45) return 'D7';
    if (percent >= 40) return 'E8';
    return 'F9';
  };
  const subjects: SubjectBreakdown[] = subjectBreakdown?.length
    ? subjectBreakdown
    : [{ subject: result.exam?.subject || result.exam?.title || 'CBT Practice', questions: total, correct, score }];
  const jambMark = isJambStyle && isMock
    ? Math.round(subjects.reduce((sum, item) => sum + (item.questions > 0 ? (item.correct / item.questions) * 100 : 0), 0))
    : Math.round((correct / Math.max(1, total)) * 100);
  const grade = gradeFor(score);
  const reference = attempt.id ? `ER-CBT-${attempt.id.replace(/[^a-zA-Z0-9]/g, '').slice(-12).toUpperCase()}` : 'ER-CBT-PENDING';

  return (
    <article className="er-result-slip" id="er-result-slip" aria-label="EduReach CBT examination result slip">
      <header className="er-result-slip-header">
        <div className="er-result-brand">
          <BrandLogo height={54} radius="50%" />
          <div>
            <strong>EduReach</strong>
            <span>Student Services &amp; CBT Practice</span>
          </div>
        </div>
        <div className="er-result-title-block">
          <span>Official practice record</span>
          <h2>CBT Examination Result</h2>
        </div>
      </header>

      <div className="er-result-rule" />

      <section className="er-result-student-grid" aria-label="Student information">
        <div><span>Student name</span><strong>{studentName || 'Guest student'}</strong></div>
        <div><span>Registration / user ID</span><strong>{studentId || 'Guest attempt'}</strong></div>
        <div><span>Examination type</span><strong>{result.exam?.exam_body || 'EduReach CBT Practice'}</strong></div>
        <div><span>Subject / course</span><strong>{result.exam?.subject || result.exam?.title || 'CBT Practice'}</strong></div>
        <div><span>Date of examination</span><strong>{formatLongDate(attempt.submitted_at)}</strong></div>
        <div><span>Duration</span><strong>{result.exam?.duration_minutes ? `${result.exam.duration_minutes} minutes` : '—'}</strong></div>
      </section>

      <section className="er-result-performance" aria-labelledby="er-result-performance-heading">
        <div className="er-result-section-heading">
          <h3 id="er-result-performance-heading">Performance summary</h3>
          <span>{grade.remark}</span>
        </div>
        <div className="er-result-subject-table-wrap">
          <table className="er-result-subject-table">
            <thead><tr><th scope="col">Subject</th><th scope="col">Questions</th><th scope="col">Correct</th><th scope="col">Score</th></tr></thead>
            <tbody>
              {subjects.map((item) => (
                <tr key={item.subject}>
                  <td>{item.subject}</td><td>{item.questions}</td><td>{item.correct}</td><td>{isWaecStyle ? gradeForSubject(item) : `${Math.round(item.score)} / 100`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="er-result-total-row">
          <span>{isWaecStyle ? 'Subject grading' : isJambStyle && isMock ? 'Total mock mark' : 'Practice mark'}</span>
          <strong>{isWaecStyle ? 'See subject grades' : isJambStyle && isMock ? `${jambMark} / 400` : `${jambMark} / 100`}</strong>
        </div>
        <div className="er-result-counts">
          <span>Total questions <b>{total}</b></span>
          <span>Correct answers <b>{correct}</b></span>
          <span>Incorrect answers <b>{incorrect}</b></span>
          <span>{isWaecStyle ? 'Grade method' : 'Performance' } <b>{isWaecStyle ? 'A1–F9 subject bands' : `${grade.grade} · ${grade.remark}`}</b></span>
        </div>
      </section>

      <footer className="er-result-slip-footer">
        <div className="er-result-signature-box">
          <span>Authorised signature</span>
          <div className="er-result-signature-line" />
          <small>EduReach authorised officer</small>
        </div>
        <div className="er-result-verification-box">
          <span>Verification reference</span>
          <strong>{reference}</strong>
          <small>Keep this reference with your result record.</small>
        </div>
      </footer>
      <p className="er-result-disclaimer">This is an EduReach CBT practice result record. It is not an official examination-body certificate and does not replace a school or examination-body result.</p>
    </article>
  );
}
