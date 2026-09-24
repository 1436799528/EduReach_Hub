import { ArrowRight, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import SectionHead from '../src/components/SectionHead';
import CardIdentityMark from '../src/components/CardIdentityMark';

type Formula = '50-50' | '60-40' | '70-30';

const clamp = (value: string, max: number) => Math.min(max, Math.max(0, Number(value) || 0));

export default function ScreeningCalculatorPage() {
  const [institution, setInstitution] = useState('');
  const [jamb, setJamb] = useState('');
  const [postUtme, setPostUtme] = useState('');
  const [formula, setFormula] = useState<Formula>('50-50');

  const weights = useMemo(() => {
    if (formula === '60-40') return { jamb: 60, postUtme: 40 };
    if (formula === '70-30') return { jamb: 70, postUtme: 30 };
    return { jamb: 50, postUtme: 50 };
  }, [formula]);

  const result = useMemo(() => {
    const jambScore = clamp(jamb, 400);
    const postScore = clamp(postUtme, 100);
    const jambPercent = (jambScore / 400) * 100;
    const postPercent = postScore;
    const aggregate = (jambPercent * weights.jamb + postPercent * weights.postUtme) / 100;
    return { jambScore, postScore, jambPercent, postPercent, aggregate };
  }, [jamb, postUtme, weights]);

  function reset() {
    setInstitution('');
    setJamb('');
    setPostUtme('');
    setFormula('50-50');
  }

  const ready = jamb !== '' || postUtme !== '';

  return (
    <HubLayout>
      <div className="hub-page" style={{ padding: '18px 0 50px' }}>
        <div className="hub-container hub-narrow">
          <div
            className="hub-section-heading hub-page-heading-compact"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
              <CardIdentityMark value="calculator" type="service" size="sm" />
              <div>
                <h1 style={{ fontSize: '19px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                  Screening Aggregate Calculator
                </h1>
                <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#64748b' }}>
                  Enter your JAMB and Post-UTME scores to estimate your aggregate.
                </p>
              </div>
            </div>
            <button type="button" className="hub-outline-btn" onClick={reset} style={{ fontSize: '11px', padding: '5px 9px' }}>
              <RotateCcw size={13} /> Reset
            </button>
          </div>

          <div className="hub-calculator-card">
            <div style={{ display: 'grid', gap: '12px' }}>
              <div>
                <label htmlFor="screening-institution" style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                  School (optional)
                </label>
                <input
                  id="screening-institution"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="e.g. University of Calabar"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: '10px',
                }}
              >
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                  JAMB / UTME score
                  <input
                    type="number"
                    min="0"
                    max="400"
                    value={jamb}
                    onChange={(e) => setJamb(e.target.value)}
                    placeholder="0 – 400"
                    style={{ width: '100%', marginTop: '5px', boxSizing: 'border-box' }}
                  />
                  <small style={{ display: 'block', marginTop: '4px', color: '#64748b', fontWeight: 400, fontSize: '12px' }}>
                    Your JAMB score out of 400.
                  </small>
                </label>

                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                  Post-UTME score
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={postUtme}
                    onChange={(e) => setPostUtme(e.target.value)}
                    placeholder="0 – 100"
                    style={{ width: '100%', marginTop: '5px', boxSizing: 'border-box' }}
                  />
                  <small style={{ display: 'block', marginTop: '4px', color: '#64748b', fontWeight: 400, fontSize: '12px' }}>
                    Your screening score out of 100.
                  </small>
                </label>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '11px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '7px' }}>
                  Which formula should I use?
                </div>
                <div style={{ display: 'grid', gap: '6px' }}>
                  {([
                    ['50-50', '50% JAMB + 50% Post-UTME'],
                    ['60-40', '60% JAMB + 40% Post-UTME'],
                    ['70-30', '70% JAMB + 30% Post-UTME'],
                  ] as const).map(([value, label]) => (
                    <label key={value} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11.5px', color: '#334155', fontWeight: 600 }}>
                      <input
                        type="radio"
                        name="formula"
                        value={value}
                        checked={formula === value}
                        onChange={() => setFormula(value)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <p style={{ margin: '8px 0 0', fontSize: '12.5px', color: '#64748b', lineHeight: 1.5 }}>
                  These are calculation options, not a claim that every school uses them. Always confirm your school's current screening formula.
                </p>
              </div>

              <div
                style={{
                  background: '#ecfdf5',
                  border: '1px solid #bbf7d0',
                  borderRadius: '10px',
                  padding: '14px',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: '12px',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#047857', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    Estimated aggregate
                  </div>
                  <strong style={{ display: 'block', marginTop: '2px', fontSize: '30px', lineHeight: 1, color: '#065f46' }}>
                    {ready ? result.aggregate.toFixed(2) : '—'}
                  </strong>
                  <span style={{ display: 'block', marginTop: '5px', fontSize: '11px', color: '#475569' }}>
                    {institution || 'Your selected formula'} • out of 100
                  </span>
                </div>
                <div style={{ textAlign: 'right', fontSize: '11px', color: '#475569', lineHeight: 1.6 }}>
                  <div>JAMB contribution: <strong>{ready ? ((result.jambPercent * weights.jamb) / 100).toFixed(2) : '—'}</strong></div>
                  <div>Post-UTME contribution: <strong>{ready ? ((result.postPercent * weights.postUtme) / 100).toFixed(2) : '—'}</strong></div>
                </div>
              </div>

              <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.5 }}>
                <strong style={{ color: '#334155' }}>How it works:</strong> JAMB is first converted from 400 to 100, then the selected percentages are applied. For example, 240 JAMB becomes 60/100.
              </div>
            </div>
          </div>

          <section className="er-section">
            <SectionHead title="Keep preparing" href="/cbt" linkLabel="Question banks" />
            <div className="er-guide-strip">
              <a href="/cbt/practice?exam=practice-exam-post-utme">Start Post-UTME test <ArrowRight size={11} /></a>
              <a href="/post-utme">Post-UTME guide <ArrowRight size={11} /></a>
              <a href="/services/apply/admission-letters">Admission letters <ArrowRight size={11} /></a>
              <a href="/news?category=admission">Admission updates <ArrowRight size={11} /></a>
            </div>
          </section>
        </div>
      </div>
    </HubLayout>
  );
}
