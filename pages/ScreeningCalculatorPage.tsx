import { RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import HubLayout from '../src/components/HubLayout';

const clamp = (value: string, min: number, max: number) => Math.min(max, Math.max(min, Number(value) || 0));

export default function ScreeningCalculatorPage() {
  const [institution, setInstitution] = useState('');
  const [jamb, setJamb] = useState('250');
  const [postUtme, setPostUtme] = useState('70');
  const [olevel, setOlevel] = useState('75');
  const [jambWeight, setJambWeight] = useState('50');
  const [postUtmeWeight, setPostUtmeWeight] = useState('20');
  const [olevelWeight, setOlevelWeight] = useState('30');

  const calculation = useMemo(() => {
    const jambPercent = clamp(jamb, 0, 400) / 4;
    const postUtmePercent = clamp(postUtme, 0, 100);
    const olevelPercent = clamp(olevel, 0, 100);
    const weights = {
      jamb: Math.max(0, Number(jambWeight) || 0),
      postUtme: Math.max(0, Number(postUtmeWeight) || 0),
      olevel: Math.max(0, Number(olevelWeight) || 0),
    };
    const weightTotal = weights.jamb + weights.postUtme + weights.olevel;
    if (!weightTotal) return { aggregate: null, jambPercent, postUtmePercent, olevelPercent, weightTotal: 0 };
    const aggregate = (
      jambPercent * weights.jamb +
      postUtmePercent * weights.postUtme +
      olevelPercent * weights.olevel
    ) / weightTotal;
    return { aggregate, jambPercent, postUtmePercent, olevelPercent, weightTotal };
  }, [jamb, postUtme, olevel, jambWeight, postUtmeWeight, olevelWeight]);

  function reset() {
    setInstitution('');
    setJamb('250');
    setPostUtme('70');
    setOlevel('75');
    setJambWeight('50');
    setPostUtmeWeight('20');
    setOlevelWeight('30');
  }

  const aggregate = calculation.aggregate === null ? '—' : calculation.aggregate.toFixed(2);

  return <HubLayout>
    <div className="hub-page">
      <div className="hub-container hub-narrow">
        <div className="hub-section-heading hub-page-heading-compact" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src="/icons/calculator.svg" alt="Calculator" width={38} height={38} style={{ objectFit: 'contain' }} />
            <div>
              <span className="hub-eyebrow" style={{ color: '#059669', fontWeight: 800 }}>ONLINE ADMISSION TOOL</span>
              <h1 style={{ fontSize: '24px', fontWeight: 900, margin: 0, color: '#0f172a' }}>Screening Score Calculator</h1>
            </div>
          </div>
          <button type="button" className="hub-outline-btn" onClick={reset}><RotateCcw size={15}/> Reset</button>
        </div>

        <div className="hub-calculator-card">
          <div className="hub-calculator-intro">
            <span className="hub-calc-badge">PLANNING TOOL</span>
            <h2>Estimate your screening aggregate</h2>
            <p>Enter the scores and weighting used by your target institution. The calculator is for planning and does not replace an official screening formula or admission decision.</p>
          </div>

          <div className="hub-form-grid">
            <label>Target Institution<input value={institution} onChange={(event) => setInstitution(event.target.value)} placeholder="e.g. University of Calabar" /></label>
            <label>JAMB / UTME Score<input type="number" min="0" max="400" value={jamb} onChange={(event) => setJamb(event.target.value)} /><small>0–400</small></label>
            <label>Post-UTME Score<input type="number" min="0" max="100" value={postUtme} onChange={(event) => setPostUtme(event.target.value)} /><small>0–100</small></label>
            <label>O'Level Screening Score<input type="number" min="0" max="100" value={olevel} onChange={(event) => setOlevel(event.target.value)} /><small>Use your institution's stated O'Level scale.</small></label>
          </div>

          <div className="hub-calculator-weighting">
            <div className="hub-section-heading compact"><div><span className="hub-eyebrow">WEIGHTING</span><h3>Set your institution's formula</h3></div></div>
            <div className="hub-form-grid">
              <label>JAMB weight (%)<input type="number" min="0" max="100" value={jambWeight} onChange={(event) => setJambWeight(event.target.value)} /></label>
              <label>Post-UTME weight (%)<input type="number" min="0" max="100" value={postUtmeWeight} onChange={(event) => setPostUtmeWeight(event.target.value)} /></label>
              <label>O'Level weight (%)<input type="number" min="0" max="100" value={olevelWeight} onChange={(event) => setOlevelWeight(event.target.value)} /></label>
            </div>
            <p className={calculation.weightTotal === 100 ? 'hub-calc-weight-ok' : 'hub-calc-weight-warn'}>Weight total: <strong>{calculation.weightTotal}%</strong>. {calculation.weightTotal === 100 ? 'Formula is balanced.' : 'The calculator normalises the weights automatically. Verify the official formula first.'}</p>
          </div>

          <div className="hub-calculator-result">
            <div>
              <span className="hub-eyebrow">ESTIMATED AGGREGATE</span>
              <strong>{aggregate}%</strong>
              <span>{institution || 'Target institution not specified'}</span>
            </div>
            <div className="hub-calculator-breakdown">
              <span><b>{calculation.jambPercent.toFixed(1)}%</b> JAMB score base</span>
              <span><b>{calculation.postUtmePercent.toFixed(1)}%</b> Post-UTME score base</span>
              <span><b>{calculation.olevelPercent.toFixed(1)}%</b> O'Level score base</span>
            </div>
          </div>
        </div>

        <div className="hub-panel hub-form-note"><strong>Important:</strong> institutions can use different formulas, subject requirements and cut-off rules. Use this calculator for planning, then confirm the current screening method directly from the institution.</div>
      </div>
    </div>
  </HubLayout>;
}
