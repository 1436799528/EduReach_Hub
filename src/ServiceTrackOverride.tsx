import { FormEvent, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, Search, ShieldCheck } from 'lucide-react';
import { supabase } from './lib/supabase';

interface ServiceRequestRow {
  id: string;
  reference_code: string | null;
  status: string;
  payment_status: string | null;
  created_at: string;
  updated_at: string;
  form_data: Record<string, unknown> | null;
  service_catalog?: { title?: string | null } | null;
}

const statusLabel: Record<string, string> = {
  submitted: 'Pending review',
  reviewing: 'Under review',
  processing: 'Processing',
  completed: 'Completed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

function normalise(value: string) {
  return value.trim().toUpperCase();
}

export default function ServiceTrackOverride() {
  const [refCode, setRefCode] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ServiceRequestRow | null>(null);
  const [error, setError] = useState('');

  async function handleTrack(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setResult(null);
    setError('');

    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setError('Sign in first so EduReach can securely show your service request.');
        return;
      }

      const { data, error: requestError } = await supabase
        .from('service_requests')
        .select('id,reference_code,status,payment_status,created_at,updated_at,form_data,service_catalog(title)')
        .eq('user_id', auth.user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (requestError) throw requestError;

      const wantedRef = normalise(refCode);
      const wantedPhone = phone.trim();
      const found = (data as ServiceRequestRow[] | null)?.find((request) => {
        const requestRef = normalise(request.reference_code || String(request.form_data?.reference_code || ''));
        const requestPhone = String(request.form_data?.whatsapp || request.form_data?.phone || '').trim();
        return (!wantedRef && !wantedPhone) || (wantedRef && requestRef === wantedRef) || (wantedPhone && requestPhone === wantedPhone);
      });

      if (!found) {
        setError('No active service request matched that reference code or phone number.');
        return;
      }

      setResult(found);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load your service request.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    document.title = 'Application Tracking | EduReach Hub';
  }, []);

  const status = result ? statusLabel[result.status] || result.status : '';
  const processing = result?.status === 'processing' || result?.status === 'reviewing';

  return (
    <section className="page service-track-page">
      <div className="container service-track-container">
        <div className="page-head">
          <span className="eyebrow">SERVICES</span>
          <h1>Track Digital Service Request</h1>
        </div>

        <div className="service-track-card">
          <div className="service-track-intro">
            <span className="service-track-pill">APPLICATION RADAR</span>
            <h2>Track your EduReach request</h2>
            <p>Enter the reference code you received after submission, or use the phone number included in your request.</p>
          </div>

          <form onSubmit={handleTrack} className="service-track-form">
            <div className="service-track-input-wrap">
              <Search size={17} />
              <input
                value={refCode}
                onChange={(event) => setRefCode(event.target.value.toUpperCase())}
                placeholder="e.g. ER-2026-A82F"
                autoComplete="off"
                aria-label="Reference code"
              />
            </div>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="WhatsApp / phone number"
              aria-label="Phone number"
            />
            <button className="primary" type="submit" disabled={loading || (!refCode.trim() && !phone.trim())}>
              {loading ? 'Searching...' : 'Track request'}
            </button>
          </form>

          {error && (
            <div className="service-track-error">
              <AlertCircle size={17} />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="service-track-result">
              <div className="service-track-result-head">
                <div>
                  <small>REFERENCE</small>
                  <h3>{result.reference_code}</h3>
                  <p>{result.service_catalog?.title || 'EduReach Service Request'}</p>
                </div>
                <span className={`service-status ${processing ? 'processing' : result.status === 'completed' ? 'completed' : result.status === 'rejected' ? 'rejected' : ''}`}>
                  {processing ? <Clock3 size={15} /> : <CheckCircle2 size={15} />}
                  {status}
                </span>
              </div>

              <div className="service-track-steps">
                <div className={result.status !== 'rejected' ? 'done' : ''}><CheckCircle2 size={17} /><span>Request submitted and recorded</span></div>
                <div className={processing || result.status === 'completed' ? 'done' : ''}><Clock3 size={17} /><span>Service processing / verification</span></div>
                <div className={result.status === 'completed' ? 'done' : ''}><CheckCircle2 size={17} /><span>Completion and notification</span></div>
              </div>

              <div className="service-track-meta">
                <span>Submitted: {new Date(result.created_at).toLocaleString()}</span>
                <span>Last updated: {new Date(result.updated_at).toLocaleString()}</span>
                <span>Payment: {result.payment_status || 'unpaid'}</span>
                <span className="verified"><ShieldCheck size={14} /> Secure handling</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
