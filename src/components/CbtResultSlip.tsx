import BrandLogo from './BrandLogo';

type ResultQuestion = {
  position?: number;
  question_text?: string;
  correct_option?: string;
};

type ResultData = {
  attempt?: {
    id?: string;
    exam_id?: string;
    score?: number;
    correct_answers?: number;
    total_questions?: number;
    submitted_at?: string | null;
  };
  exam?: {
    title?: string | null;
    exam_body?: string | null;
    subject?: string | null;
    duration_minutes?: number | null;
  } | null;
  questions?: ResultQuestion[];
  subjects?: Array<{ subject: string; questions: number; correct: number; score: number }>;
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-NG', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
}

function gradeFor(score: number) {
  if (score >= 70) return { grade: 'A', remark: 'Excellent performance' };
  if (score >= 60) return { grade: 'B', remark: 'Good performance' };
  if (score >= 50) return { grade: 'C', remark: 'Fair performance' };
  if (score >= 40) return { grade: 'D', remark: 'Keep practising' };
  return { grade: 'E', remark: 'More practice is needed' };
}

export default function CbtResultSlip({ result, studentName, studentId }: { result: ResultData; studentName: string; studentId: string }) {
  const attempt = result.attempt || {};
  const score = Number(attempt.score || 0);
  const total = Number(attempt.total_questions || result.questions?.length || 0);
  const correct = Number(attempt.correct_answers || 0);
  const incorrect = Math.max(0, total - correct);
  const grade = gradeFor(score);
  const subjects = result.subjects?.length
    ? result.subjects
    : [{ subject: result.exam?.subject || result.exam?.title || 'CBT Practice', questions: total, correct, score }];
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
        <div><span>Date of examination</span><strong>{formatDate(attempt.submitted_at)}</strong></div>
        <div><span>Duration</span><strong>{result.exam?.duration_minutes ? `${result.exam.duration_minutes} minutes` : '—'}</strong></div>
      </section>

      <section className="er-result-performance" aria-labelledby="er-result-performance-heading">
        <div className="er-result-section-heading">
          <h3 id="er-result-performance-heading">Performance summary</h3>
          <span>{grade.remark}</span>
        </div>
        <div className="er-result-subject-table-wrap">
          <table className="er-result-subject-table">
            <thead><tr><th>Subject</th><th>Questions</th><th>Correct</th><th>Score</th></tr></thead>
            <tbody>
              {subjects.map((item) => (
                <tr key={item.subject}>
                  <td>{item.subject}</td><td>{item.questions}</td><td>{item.correct}</td><td>{Number(item.score).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="er-result-total-row">
          <span>Overall score</span>
          <strong>{score.toFixed(1)}%</strong>
        </div>
        <div className="er-result-counts">
          <span>Total questions <b>{total}</b></span>
          <span>Correct answers <b>{correct}</b></span>
          <span>Incorrect answers <b>{incorrect}</b></span>
          <span>Grade / remark <b>{grade.grade} · {grade.remark}</b></span>
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

export { formatDate, gradeFor };
