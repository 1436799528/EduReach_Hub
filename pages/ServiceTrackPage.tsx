import { FormEvent, useState } from 'react';
import { CheckCircle2, Circle, Search, Clock3 } from 'lucide-react';
import HubLayout from '../src/components/HubLayout';
import { trackService } from '../src/lib/api';

const fallbackTimeline = [
  { label: 'Received', done: true },
  { label: 'Payment Verified', done: true },
  { label: 'Institutional Verification', done: false },
  { label: 'Completed', done: false },
];

export default function ServiceTrackPage() {
  const [referenceCode, setReferenceCode] = useState('');
  const [timeline, setTimeline] = useState(fallbackTimeline);
  const [message, setMessage] = useState('');
  const [searched, setSearched] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(''); setSearched(false);
    try {
      const data = await trackService(referenceCode.trim());
      setTimeline(data.timeline || fallbackTimeline);
    } catch {
      setMessage('No live tracking API is connected yet. Showing the tracker layout with the submitted reference.');
      setTimeline(fallbackTimeline);
    }
    setSearched(true);
  }

  return <HubLayout><div className="hub-page"><div className="hub-container hub-narrow">
    <div className="hub-page-title"><span className="hub-eyebrow">APPLICATION TRACKER</span><h1>Track your EduReach request.</h1><p>Enter your 10-character reference code, for example <strong>ER-2026-X892</strong>.</p></div>
    <form className="hub-track-box" onSubmit={submit}><Search size={21}/><input value={referenceCode} onChange={(e)=>setReferenceCode(e.target.value.toUpperCase())} maxLength={11} placeholder="ER-2026-X892" aria-label="Reference code" required/><button className="hub-primary-btn">Track Status</button></form>
    {message && <div className="hub-form-note">{message}</div>}
    {searched && <div className="hub-panel hub-tracker-panel"><div className="hub-tracker-head"><div><span className="hub-eyebrow">REFERENCE</span><h2>{referenceCode}</h2></div><span className="hub-status-pill">In Progress</span></div><div className="hub-timeline">{timeline.map((item) => <div className={`hub-timeline-item ${item.done ? 'done' : ''}`} key={item.label}><div className="hub-timeline-icon">{item.done ? <CheckCircle2 size={18}/> : <Circle size={18}/>}</div><div><strong>{item.label}</strong><p>{item.done ? 'Stage completed or verified.' : 'Waiting for the next processing stage.'}</p></div></div>)}</div><div className="hub-tracker-foot"><Clock3 size={17}/> Status updates are shown here when the backend tracker is connected.</div></div>}
  </div></div></HubLayout>;
}
