import { ArrowRight, Info, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import SectionHead from '../src/components/SectionHead';
import CardIdentityMark, { identityClassFor } from '../src/components/CardIdentityMark';
import { admissionMethodProfiles } from '../src/data/examPreparation';
import '../src/screening-calculator.css';

type Formula = '50-50' | '60-40' | '70-30' | 'jamb-only' | 'points';

// Keep the field itself inside the real range, not just the computed result.
// A number input can otherwise be nudged or typed past the maximum while the
// calculation silently clamps it — the score on screen would disagree with the
// score being used.
function clampScoreInput(value: string, max: number): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  return String(Math.min(max, Number(digits)));
}

const clamp = (value: string, max: number) => Math.min(max, Math.max(0, Number(value) || 0));

const FORMULAS: Array<{ value: Formula; label: string; summary: string }> = [
  { value: '50-50', label: '50 / 50', summary: 'Half JAMB, half Post-UTME' },
  { value: '60-40', label: '60 / 40', summary: 'JAMB carries more weight' },
  { value: '70-30', label: '70 / 30', summary: 'JAMB-heavy screening' },
  { value: 'jamb-only', label: 'JAMB only', summary: 'Cut-off planning' },
  { value: 'points', label: 'Points', summary: 'Requirement planning' },
];

export default function ScreeningCalculatorPage() {
  const [institution, setInstitution] = useState('custom');
  const [jamb, setJamb] = useState('');
  const [postUtme, setPostUtme] = useState('');
  const [formula, setFormula] = useState<Formula>('50-50');

  const methodProfile = admissionMethodProfiles.find((profile) => profile.id === institution) || admissionMethodProfiles[admissionMethodProfiles.length - 1];

  const weights = useMemo(() => {
    if (formula === '60-40') return { jamb: 60, postUtme: 40 };
    if (formula === '70-30') return { jamb: 70, postUtme: 30 };
    if (formula === 'jamb-only') return { jamb: 100, postUtme: 0 };
    return { jamb: 50, postUtme: 50 };
  }, [formula]);

  const result = useMemo(() => {
    const jambScore = clamp(jamb, 400);
    const postScore = clamp(postUtme, 400);
    const jambPercent = (jambScore / 400) * 100;
    // Most schools print Post-UTME out of 100; some print it out of 400. Values
    // above 100 are read on the 400 scale rather than silently becoming >100%.
    const postPercent = postScore > 100 ? (postScore / 400) * 100 : postScore;
    const aggregate = formula === 'points'
      ? (jambPercent + postPercent) / 2
      : (jambPercent * weights.jamb + postPercent * weights.postUtme) / 100;
    return { jambScore, postScore, jambPercent, postPercent, aggregate };
  }, [formula, jamb, postUtme, weights]);

  function reset() {
    setInstitution('custom');
    setJamb('');
    setPostUtme('');
    setFormula('50-50');
  }

  const ready = jamb !== '' || postUtme !== '';
  const jambContribution = formula === 'jamb-only' ? result.jambPercent : (result.jambPercent * weights.jamb) / 100;
  const postContribution = formula === 'points' ? result.postPercent : (result.postPercent * weights.postUtme) / 100;
  const ringLength = 339.292;
  const ringDash = Math.max(0, Math.min(100, result.aggregate)) / 100 * ringLength;

  return (
    <HubLayout>
      <div className="scr-page">
        <div className="hub-container">
          <header className="scr-head">
            <div className="scr-head-copy">
              <span className="scr-eyebrow">Admission planning</span>
              <h1>Screening aggregate calculator</h1>
              <p>Estimate how your JAMB and Post-UTME scores combine under the model a school is likely to use. It is a planning score, not a cut-off decision.</p>
            </div>
            <div className="scr-head-actions">
              <CardIdentityMark value="calculator" type="service" size="sm" />
              <button type="button" className="scr-reset" onClick={reset}><RotateCcw size={14} /> Reset</button>
            </div>
          </header>

          <div className="scr-layout">
            <div className="scr-form-card">
              <div className="scr-block">
                <label className="scr-label" htmlFor="screening-institution">School method profile</label>
                <select
                  id="screening-institution"
                  value={institution}
                  onChange={(event) => {
                    const next = admissionMethodProfiles.find((profile) => profile.id === event.target.value) || admissionMethodProfiles[admissionMethodProfiles.length - 1];
                    setInstitution(next.id);
                    setFormula(next.formula);
                  }}
                >
                  {admissionMethodProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.school}</option>)}
                </select>
                <p className="scr-method-hint"><strong>{methodProfile.method}</strong> {methodProfile.explanation}</p>
              </div>

              <div className="scr-scores">
                <label className="scr-field">
                  <span>JAMB / UTME score</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={3}
                    value={jamb}
                    onChange={(e) => setJamb(clampScoreInput(e.target.value, 400))}
                    placeholder="0 – 400"
                    aria-describedby="screening-jamb-help"
                  />
                  <small id="screening-jamb-help">Out of 400, never more. We convert it to a 100-point scale first.</small>
                </label>
                <label className="scr-field">
                  <span>Post-UTME score</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={3}
                    value={postUtme}
                    onChange={(e) => setPostUtme(clampScoreInput(e.target.value, 400))}
                    placeholder="0 – 100 or 400"
                    aria-describedby="screening-postutme-help"
                  />
                  <small id="screening-postutme-help">Capped at 400. Use the scale printed on your screening slip (100 or 400).</small>
                </label>
              </div>

              <fieldset className="scr-formula-block">
                <legend>Which formula should I use?</legend>
                <div className="scr-formula-grid">
                  {FORMULAS.map((option) => (
                    <label key={option.value} className={`scr-formula${formula === option.value ? ' is-active' : ''}`}>
                      <input
                        type="radio"
                        name="formula"
                        value={option.value}
                        checked={formula === option.value}
                        onChange={() => setFormula(option.value)}
                      />
                      <strong>{option.label}</strong>
                      <small>{option.summary}</small>
                    </label>
                  ))}
                </div>
                <p className="scr-footnote">
                  These are planning models, not a claim that every school uses them. Always confirm the current school brochure; some institutions use O-Level points, cut-offs or programme-specific requirements instead.
                </p>
              </fieldset>

              <div className="scr-explainer">
                <Info size={15} aria-hidden="true" />
                <p><strong>How it works.</strong> JAMB is converted from 400 to 100, then the selected percentages are applied. For example, 240 in JAMB becomes 60 out of 100.</p>
              </div>
            </div>

            <aside className="scr-result-card" aria-label="Screening estimate">
              <div className="scr-result-top">
                <span className="scr-result-label">Estimated aggregate</span>
                <span className="scr-result-school">{methodProfile.school}</span>
              </div>

              <div className="scr-gauge">
                <svg viewBox="0 0 160 160" role="img" aria-label={ready ? `Estimated aggregate ${result.aggregate.toFixed(2)} out of 100` : 'No estimate yet'}>
                  <circle cx="80" cy="80" r="54" fill="none" stroke="rgba(255,255,255,.16)" strokeWidth="12" />
                  <circle
                    cx="80"
                    cy="80"
                    r="54"
                    fill="none"
                    stroke="#7cc4f5"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray={`${ringDash} ${ringLength}`}
                    transform="rotate(-90 80 80)"
                  />
                </svg>
                <div className="scr-gauge-value">
                  <strong>{ready ? result.aggregate.toFixed(2) : '—'}</strong>
                  <span>out of 100</span>
                </div>
              </div>

              <div className="scr-contributions">
                <div>
                  <span>JAMB contribution</span>
                  <strong>{ready ? jambContribution.toFixed(2) : '—'}</strong>
                  <div className="scr-track"><i style={{ width: `${ready ? Math.min(100, jambContribution) : 0}%` }} /></div>
                </div>
                <div>
                  <span>{formula === 'points' ? 'Post-UTME planning input' : 'Post-UTME contribution'}</span>
                  <strong>{ready ? postContribution.toFixed(2) : '—'}</strong>
                  <div className="scr-track"><i style={{ width: `${ready ? Math.min(100, postContribution) : 0}%`, background: '#b9e0ff' }} /></div>
                </div>
              </div>

              <p className="scr-result-note">
                {ready
                  ? `Based on ${formula === 'points' ? 'a points-planning model' : (formula === 'jamb-only' ? 'a JAMB-only model' : `${weights.jamb}% JAMB and ${weights.postUtme}% Post-UTME`)}. Confirm the active cut-off with ${methodProfile.school}.`
                  : 'Enter one or both scores to see the estimate and how each part contributes.'}
              </p>
            </aside>
          </div>

          <section className="er-methods-section" aria-labelledby="admission-methods-title">
            <div className="er-methods-heading">
              <div>
                <span className="hub-eyebrow">Admission guidance</span>
                <h2 id="admission-methods-title">How different schools may assess applicants</h2>
                <p>Schools can combine UTME, Post-UTME, O-Level grades, cut-offs and programme requirements differently. Use these profiles to know what to look for, then confirm the active notice.</p>
              </div>
              <CardIdentityMark value="admission requirements" type="service" size="sm" />
            </div>
            <div className="er-methods-grid">
              {admissionMethodProfiles.filter((profile) => profile.id !== 'custom').map((profile) => (
                <article className={`er-method-card ${identityClassFor('admission requirements', 'service')}`} key={profile.id}>
                  <h3>{profile.school}</h3>
                  <strong>{profile.method}</strong>
                  <p>{profile.explanation}</p>
                  <small>{profile.officialReminder}</small>
                </article>
              ))}
            </div>
          </section>

          <section className="er-section">
            <SectionHead title="Keep preparing" href="/cbt" linkLabel="Question banks" />
            <div className="er-guide-strip">
              <a href="/cbt/setup/post-utme">Start Post-UTME test <ArrowRight size={11} /></a>
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
