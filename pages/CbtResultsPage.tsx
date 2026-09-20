import { useEffect, useState } from 'react';
import {
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Printer,
  RotateCcw,
  Sparkles,
  XCircle,
} from 'lucide-react';
import HubLayout from '../src/components/HubLayout';
import { fetchCbtResult } from '../src/lib/api';

export default function CbtResultsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    const attemptId =
      new URLSearchParams(window.location.search).get('attempt') ||
      localStorage.getItem('edureach-last-cbt-attempt') ||
      'demo-attempt-preview';

    void fetchCbtResult(attemptId)
      .then(setResult)
      .catch((value) => setError(value instanceof Error ? value.message : 'Unable to load the CBT result.'))
      .finally(() => setLoading(false));
  }, []);

  const score = result?.attempt ? Math.round(Number(result.attempt.score || 0)) : 0;
  const isPass = score >= 60;
  const correctCount = result?.attempt?.correct_answers ?? 0;
  const totalCount = result?.attempt?.total_questions ?? 0;
  const missedCount = totalCount - correctCount;

  return (
    <HubLayout>
      <div className="hub-page" style={{ padding: '24px 0 60px' }}>
        <div className="hub-container" style={{ maxWidth: '900px' }}>
          {loading && (
            <div className="hub-panel hub-empty" style={{ padding: '48px', textAlign: 'center' }}>
              <Sparkles size={24} style={{ color: '#059669', marginBottom: '8px' }} />
              <p style={{ fontWeight: 700, color: '#0f172a' }}>Calculating CBT test score and performance analysis…</p>
            </div>
          )}

          {!loading && error && (
            <div className="hub-panel hub-empty" style={{ padding: '40px', textAlign: 'center' }}>
              <p style={{ color: '#b91c1c', marginBottom: '16px' }}>{error}</p>
              <a className="hub-primary-btn" href="/cbt" style={{ textDecoration: 'none' }}>
                Start CBT Practice
              </a>
            </div>
          )}

          {!loading && result && (
            <>
              {/* MYSCHOOL RESULT SCORECARD BANNER */}
              <div
                style={{
                  background: isPass
                    ? 'linear-gradient(135deg, #065f46 0%, #047857 100%)'
                    : 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                  color: '#ffffff',
                  borderRadius: '16px',
                  padding: '28px',
                  marginBottom: '24px',
                  boxShadow: '0 10px 25px rgba(6, 95, 70, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '20px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <img
                    src="/icons/cbt.svg"
                    alt="CBT Emblem"
                    width={52}
                    height={52}
                    style={{ objectFit: 'contain', flexShrink: 0 }}
                  />
                  <div>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'rgba(255, 255, 255, 0.15)',
                        padding: '4px 10px',
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        marginBottom: '6px',
                      }}
                    >
                      <Award size={13} /> Official CBT Performance Report
                    </div>
                    <h1 style={{ fontSize: '24px', fontWeight: 900, margin: '0 0 4px', color: '#ffffff' }}>
                      {isPass ? 'Distinction Performance!' : 'Practice Completed'}
                    </h1>
                    <p style={{ fontSize: '13px', margin: 0, opacity: 0.9, maxWidth: '440px', lineHeight: 1.4 }}>
                      {isPass
                        ? 'Congratulations on exceeding the 60% mark. Review the corrections below to eliminate residual blind spots.'
                        : 'Review each detailed question explanation below to master key formulas and facts.'}
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '20px',
                    background: 'rgba(255, 255, 255, 0.12)',
                    padding: '16px 24px',
                    borderRadius: '14px',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                  }}
                >
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '38px', fontWeight: 900, lineHeight: 1, letterSpacing: '-0.02em' }}>
                      {score}%
                    </div>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', opacity: 0.85, fontWeight: 700, marginTop: '4px' }}>
                      Overall Score
                    </div>
                  </div>

                  <div style={{ width: '1px', height: '40px', background: 'rgba(255, 255, 255, 0.2)' }} />

                  <div style={{ display: 'grid', gap: '4px', fontSize: '12px' }}>
                    <div>
                      <strong style={{ color: '#86efac' }}>{correctCount}</strong> / {totalCount} Correct
                    </div>
                    <div>
                      <strong style={{ color: '#fca5a5' }}>{missedCount}</strong> Missed
                    </div>
                  </div>
                </div>
              </div>

              {/* ACTION QUICK BAR */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '14px 18px',
                  marginBottom: '24px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#475569' }}>
                  <Clock3 size={15} color="#059669" />
                  <span>
                    Exam Date: <strong>{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="hub-outline-btn"
                    style={{ fontSize: '12px', padding: '7px 12px' }}
                  >
                    <Printer size={13} /> Print Result Slip
                  </button>
                  <a
                    href="/cbt/practice?exam=demo-exam-jamb"
                    className="hub-primary-btn"
                    style={{ textDecoration: 'none', fontSize: '12px', padding: '7px 14px' }}
                  >
                    <RotateCcw size={13} /> Retake Test
                  </a>
                </div>
              </div>

              {/* CORRECTIONS LIST */}
              <div style={{ marginBottom: '16px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#059669', letterSpacing: '0.04em' }}>
                  DETAILED ANALYSIS
                </span>
                <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', margin: '4px 0 0' }}>
                  Question by Question Corrections
                </h2>
              </div>

              <div style={{ display: 'grid', gap: '14px' }}>
                {result.questions.map((question: any) => {
                  const answer = result.answers.find((item: any) => item.question_id === question.id);
                  const isCorrect = answer?.is_correct;
                  const correctIndex = String(question.correct_option).charCodeAt(0) - 65;
                  const selectedIndex = answer?.selected_option ? String(answer.selected_option).charCodeAt(0) - 65 : null;

                  const optionsList = [
                    question.option_a,
                    question.option_b,
                    question.option_c,
                    question.option_d,
                  ];

                  return (
                    <div
                      key={question.id}
                      style={{
                        background: '#ffffff',
                        border: '1px solid',
                        borderColor: isCorrect ? '#e2e8f0' : '#fee2e2',
                        borderRadius: '12px',
                        padding: '18px 20px',
                        boxShadow: '0 2px 6px rgba(15, 23, 42, 0.03)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span
                            style={{
                              width: '26px',
                              height: '26px',
                              borderRadius: '6px',
                              background: '#f1f5f9',
                              color: '#334155',
                              display: 'grid',
                              placeItems: 'center',
                              fontSize: '12px',
                              fontWeight: 800,
                            }}
                          >
                            {question.position}
                          </span>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: '999px',
                              background: isCorrect ? '#ecfdf5' : '#fef2f2',
                              color: isCorrect ? '#047857' : '#b91c1c',
                            }}
                          >
                            {isCorrect ? (
                              <>
                                <CheckCircle2 size={12} /> Correct (+1)
                              </>
                            ) : (
                              <>
                                <XCircle size={12} /> Incorrect (0)
                              </>
                            )}
                          </span>
                        </div>
                      </div>

                      <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', margin: '0 0 14px', lineHeight: 1.5 }}>
                        {question.question_text}
                      </h3>

                      <div style={{ display: 'grid', gap: '6px', marginBottom: '14px' }}>
                        {optionsList.map((optText, optIdx) => {
                          const isOptionCorrect = optIdx === correctIndex;
                          const wasSelected = optIdx === selectedIndex;

                          let optBg = '#f8fafc';
                          let optBorder = '#e2e8f0';
                          let optColor = '#334155';

                          if (isOptionCorrect) {
                            optBg = '#ecfdf5';
                            optBorder = '#10b981';
                            optColor = '#065f46';
                          } else if (wasSelected && !isOptionCorrect) {
                            optBg = '#fef2f2';
                            optBorder = '#ef4444';
                            optColor = '#991b1b';
                          }

                          return (
                            <div
                              key={optIdx}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: `1px solid ${optBorder}`,
                                background: optBg,
                                color: optColor,
                                fontSize: '13px',
                                fontWeight: isOptionCorrect || wasSelected ? 700 : 400,
                              }}
                            >
                              <strong style={{ width: '18px' }}>{String.fromCharCode(65 + optIdx)}.</strong>
                              <span style={{ flex: 1 }}>{optText}</span>
                              {isOptionCorrect && (
                                <span style={{ fontSize: '10px', background: '#059669', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>
                                  CORRECT ANSWER
                                </span>
                              )}
                              {wasSelected && !isOptionCorrect && (
                                <span style={{ fontSize: '10px', background: '#ef4444', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>
                                  YOUR CHOICE
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* EXPLANATION BLOCK */}
                      <div
                        style={{
                          background: '#f8fafc',
                          borderLeft: '3px solid #059669',
                          padding: '10px 14px',
                          borderRadius: '0 8px 8px 0',
                          fontSize: '12px',
                          color: '#475569',
                          lineHeight: 1.5,
                        }}
                      >
                        <strong style={{ color: '#0f172a', display: 'block', marginBottom: '2px' }}>
                          Academic Explanation:
                        </strong>
                        {question.explanation ||
                          'The correct option is derived directly from the official curriculum syllabus standards. Review relevant past questions to reinforce this topic.'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </HubLayout>
  );
}
