import { FormEvent, useEffect, useState } from 'react';
import { CheckCircle2, Circle, Search, Clock3 } from 'lucide-react';
import HubLayout from '../src/components/HubLayout';
import { trackService } from '../src/lib/api';

export default function ServiceTrackPage() {
  const [referenceCode, setReferenceCode] = useState(() => new URLSearchParams(window.location.search).get('ref') || '');
  const [timeline, setTimeline] = useState<Array<{ label: string; done: boolean }>>([]);
  const [result, setResult] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [searched, setSearched] = useState(false);

  useEffect(() => { if (referenceCode) void searchReference(referenceCode); }, []);

  async function searchReference(value: string) {
    setMessage(''); setSearched(false); setResult(null);
    try {
      const data = await trackService(value.trim().toUpperCase());
      setTimeline(data.timeline || []);
      setResult(data);
    } catch (error) {
      setTimeline([]);
      setMessage(error instanceof Error ? error.message : 'Tracking request failed.');
    }
    setSearched(true);
  }

  async function submit(event: FormEvent) { event.preventDefault(); await searchReference(referenceCode); }

  return <HubLayout><div className="hub-page"><div className="hub-container hub-narrow">
    <div className="hub-page-title"><span className="hub-eyebrow">APPLICATION TRACKER</span><h1>Track your EduReach request.</h1><p>Enter the reference code you received after submitting a service request.</p></div>
    <form className="hub-track-box" onSubmit={submit}><Search size={21}/><input value={referenceCode} onChange={(e)=>setReferenceCode(e.target.value.toUpperCase())} maxLength={10} placeholder="ERXXXXXXXX" aria-label="Reference code" required/><button className="hub-primary-btn">Track Status</button></form>
    {message && <div className="hub-form-error">{message}</div>}
    {searched && result && <div className="hub-panel hub-tracker-panel"><div className="hub-tracker-head"><div><span className="hub-eyebrow">REFERENCE</span><h2>{result.reference_code}</h2><p>{result.service_catalog?.title}</p></div><span className="hub-status-pill">{result.status}</span></div><div className="hub-timeline">{timeline.map((item) => <div className={`hub-timeline-item ${item.done ? 'done' : ''}`} key={item.label}><div className="hub-timeline-icon">{item.done ? <CheckCircle2 size={18}/> : <Circle size={18}/>}</div><div><strong>{item.label}</strong><p>{item.done ? 'Stage completed or verified.' : 'Waiting for the next processing stage.'}</p></div></div>)}</div><div className="hub-tracker-foot"><Clock3 size={17}/> Submitted {new Date(result.created_at).toLocaleString()}</div></div>}
  </div></div></HubLayout>;
}
