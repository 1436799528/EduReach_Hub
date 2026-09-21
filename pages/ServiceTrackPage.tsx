import { FormEvent, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Clock3,
  ExternalLink,
  HelpCircle,
  MessageSquare,
  PackageCheck,
  Search,
  ShieldCheck,
} from 'lucide-react';
import HubLayout from '../src/components/HubLayout';
import CardIdentityMark from '../src/components/CardIdentityMark';
import { trackService } from '../src/lib/api';

function statusLabel(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function ServiceTrackPage() {
  const [referenceCode, setReferenceCode] = useState(
    () => new URLSearchParams(window.location.search).get('ref') || 'ER-9482-JAMB'
  );
  const [timeline, setTimeline] = useState<Array<{ label: string; done: boolean }>>([]);
  const [result, setResult] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (referenceCode) {
      void searchReference(referenceCode);
    }
  }, []);

  async function searchReference(value: string) {
    if (!value.trim()) return;
    setLoading(true);
    setMessage('');
    setSearched(false);
    setResult(null);

    try {
      const data = await trackService(value.trim().toUpperCase());
      setTimeline(data.timeline || []);
      setResult(data);
    } catch (error) {
      setTimeline([]);
      setMessage(error instanceof Error ? error.message : 'Tracking request failed.');
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await searchReference(referenceCode);
  }

  return (
    <HubLayout>
      <div className="hub-page" style={{ padding: '24px 0 60px' }}>
        <div className="hub-container" style={{ maxWidth: '840px' }}>
          {/* TRACKER HEADER */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: '#059669',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                background: '#ecfdf5',
                padding: '4px 12px',
                borderRadius: '999px',
                display: 'inline-block',
                marginBottom: '8px',
              }}
            >
              Real-Time Verification Portal
            </span>
            <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#0f172a', margin: '0 0 8px' }}>
              Track Application Status
            </h1>
            <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
              Enter your EduReach reference number (e.g. ER-XXXX) to monitor real-time verification and dispatch.
            </p>
          </div>

          {/* SEARCH FORM */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)',
              marginBottom: '24px',
            }}
          >
            <form
              onSubmit={submit}
              style={{
                display: 'flex',
                gap: '10px',
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  flex: '1 1 280px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Search
                  size={18}
                  style={{
                    position: 'absolute',
                    left: '14px',
                    color: '#94a3b8',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  type="text"
                  value={referenceCode}
                  onChange={(e) => setReferenceCode(e.target.value.toUpperCase())}
                  placeholder="Enter reference code (e.g. ER-9482-JAMB)"
                  aria-label="Reference code"
                  required
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 42px',
                    fontSize: '14px',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    border: '1px solid #cbd5e1',
                    borderRadius: '10px',
                    outline: 'none',
                    color: '#0f172a',
                    background: '#f8fafc',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  background: '#059669',
                  color: '#ffffff',
                  border: 0,
                  borderRadius: '10px',
                  padding: '12px 24px',
                  fontSize: '14px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)',
                }}
              >
                {loading ? 'Tracking…' : 'Track Status'}
              </button>
            </form>

            <div
              style={{
                marginTop: '14px',
                paddingTop: '12px',
                borderTop: '1px solid #f1f5f9',
                fontSize: '11px',
                color: '#64748b',
                fontWeight: 600,
              }}
            >
              Enter the reference code from your submitted EduReach service request receipt.
            </div>
          </div>

          {message && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                padding: '14px',
                borderRadius: '10px',
                marginBottom: '20px',
                fontSize: '13px',
              }}
            >
              {message}
            </div>
          )}

          {/* TRACKING RESULT PANEL */}
          {searched && result && (
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '24px',
                boxShadow: '0 4px 16px rgba(15, 23, 42, 0.06)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '14px',
                  paddingBottom: '20px',
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <CardIdentityMark value={result.service_catalog?.title || result.reference_code || 'services'} type="service" size="md" />
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                      TRACKING REFERENCE
                    </span>
                    <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', margin: '1px 0 2px', letterSpacing: '0.02em' }}>
                      {result.reference_code}
                    </h2>
                    <p style={{ margin: 0, fontSize: '13px', color: '#059669', fontWeight: 700 }}>
                      {result.service_catalog?.title || 'EduReach Academic Service Request'}
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    background: '#ecfdf5',
                    color: '#047857',
                    border: '1px solid #a7f3d0',
                    padding: '6px 14px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <ShieldCheck size={15} />
                  <span>{statusLabel(result.status || 'processing')}</span>
                </div>
              </div>

              {/* TIMELINE PROGRESS */}
              <div style={{ padding: '24px 0' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '16px' }}>
                  Processing Stages
                </span>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${timeline.length || 4}, 1fr)`,
                    gap: '12px',
                    position: 'relative',
                  }}
                >
                  {timeline.map((step, idx) => {
                    const isDone = step.done;
                    return (
                      <div
                        key={step.label}
                        style={{
                          textAlign: 'center',
                          padding: '14px 10px',
                          background: isDone ? '#ecfdf5' : '#f8fafc',
                          border: `1px solid ${isDone ? '#10b981' : '#e2e8f0'}`,
                          borderRadius: '12px',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            background: isDone ? '#059669' : '#cbd5e1',
                            color: '#ffffff',
                            display: 'grid',
                            placeItems: 'center',
                            margin: '0 auto 8px',
                            fontSize: '13px',
                            fontWeight: 900,
                          }}
                        >
                          {isDone ? <CheckCircle2 size={16} /> : idx + 1}
                        </div>
                        <strong
                          style={{
                            display: 'block',
                            fontSize: '13px',
                            color: isDone ? '#065f46' : '#64748b',
                            fontWeight: 800,
                          }}
                        >
                          {step.label}
                        </strong>
                        <span style={{ fontSize: '11px', color: isDone ? '#059669' : '#94a3b8' }}>
                          {isDone ? 'Completed' : 'Pending'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* DETAILS SUMMARY & HELP */}
              <div
                style={{
                  background: '#f8fafc',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#475569' }}>
                  <Clock size={15} color="#059669" />
                  <span>
                    Initiated:{' '}
                    <strong>
                      {result.created_at
                        ? new Date(result.created_at).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Today'}
                    </strong>
                  </span>
                </div>

                <a
                  href={`https://wa.me/2349130134969?text=${encodeURIComponent(`Hello EduReach Support, I am tracking reference ${result.reference_code}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#059669',
                    textDecoration: 'none',
                  }}
                >
                  <MessageSquare size={14} /> Contact Officer for this Request
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </HubLayout>
  );
}
