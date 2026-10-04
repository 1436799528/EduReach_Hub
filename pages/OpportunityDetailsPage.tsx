import { ArrowLeft, ArrowRight, CalendarClock, CheckCircle2, ExternalLink, MapPin, ShieldCheck, ShieldQuestion, Tag, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import CardIdentityMark, { identityClassFor } from '../src/components/CardIdentityMark';
import { fetchOpportunity, type Opportunity } from '../src/lib/api';
import { opportunityStatus } from '../src/lib/opportunityStatus';
import { plainTextFromHtml } from '../src/lib/html-sanitize';
import { isSupabaseConfigured } from '../src/lib/supabase';

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not specified';
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Not specified';
}

export default function OpportunityDetailsPage({ opportunityId }: { opportunityId: string }) {
  const [item, setItem] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(false);
    fetchOpportunity(opportunityId)
      .then((value) => { if (active) setItem(value); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [opportunityId]);

  if (!isSupabaseConfigured) {
    return (
      <HubLayout>
        <div className="hub-page" style={{ padding: '30px 0 70px' }}>
          <div className="hub-container hub-narrow">
            <a href="/jobs" className="hub-outline-btn" style={{ textDecoration: 'none' }}><ArrowLeft size={14} /> Back to opportunities</a>
            <div className="hub-panel hub-empty" style={{ marginTop: '18px' }}>
              Opportunity details are available when the EduReach backend is connected.
            </div>
          </div>
        </div>
      </HubLayout>
    );
  }

  if (loading) {
    return <HubLayout><div className="hub-page" style={{ padding: '30px 0 70px' }}><div className="hub-container hub-narrow"><div className="hub-panel hub-empty">Loading opportunity details…</div></div></div></HubLayout>;
  }

  if (error || !item) {
    return (
      <HubLayout>
        <div className="hub-page" style={{ padding: '30px 0 70px' }}>
          <div className="hub-container hub-narrow">
            <a href="/jobs" className="hub-outline-btn" style={{ textDecoration: 'none' }}><ArrowLeft size={14} /> Back to opportunities</a>
            <div className="hub-panel hub-empty" role="alert" style={{ marginTop: '18px' }}>
              <h1 style={{ margin: '0 0 7px', fontSize: '20px' }}>Opportunity not found</h1>
              <p style={{ margin: 0, color: '#5e6c82', fontSize: '13px' }}>This listing may have closed, been removed, or is temporarily unavailable.</p>
            </div>
          </div>
        </div>
      </HubLayout>
    );
  }

  const status = opportunityStatus(item);
  const description = plainTextFromHtml(item.description || '');
  const applyHref = item.link_url || '/jobs';
  const verified = status.verification === 'verified';

  return (
    <HubLayout>
      <main className="hub-page" style={{ padding: '24px 0 70px' }}>
        <div className="hub-container hub-narrow">
          <a href="/jobs" className="hub-outline-btn" style={{ textDecoration: 'none', marginBottom: '16px' }}>
            <ArrowLeft size={14} /> Back to opportunities
          </a>

          <article className={`hub-panel ${identityClassFor(`${item.category} ${item.title}`, 'content')}`} style={{ padding: 0, overflow: 'hidden' }}>
            <header style={{ padding: '22px 22px 20px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                <CardIdentityMark value={`${item.title} ${item.category} ${item.organisation || ''}`} type="content" size="md" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="er-opportunity-chips">
                    <span className="er-opp-chip is-category"><Tag size={11} /> {item.subcategory || item.category}</span>
                    <span className={`er-opp-chip ${status.actionable ? (status.state === 'closing-soon' ? 'is-closing' : 'is-open') : 'is-expired'}`}>
                      <CalendarClock size={11} /> {status.stateLabel}
                    </span>
                    <span className={`er-opp-chip ${verified ? 'is-verified' : 'is-unverified'}`}>
                      {verified ? <ShieldCheck size={11} /> : <ShieldQuestion size={11} />} {status.verificationLabel}
                    </span>
                  </div>
                  <h1 style={{ margin: '8px 0 5px', fontSize: '26px', lineHeight: 1.2, color: '#0f172a' }}>{item.title}</h1>
                  {item.organisation && <p style={{ margin: 0, color: '#5e6c82', fontSize: '14px', fontWeight: 600 }}>{item.organisation}</p>}
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '16px' }}>
                {item.locations && <span className="er-opp-chip"><MapPin size={12} /> {item.locations}</span>}
                {item.work_mode && item.work_mode !== 'not-specified' && <span className="er-opp-chip">{item.work_mode === 'onsite' ? 'On-site' : item.work_mode === 'remote' ? 'Remote' : 'Hybrid'}</span>}
                {item.deadline && <span className="er-opp-chip"><CalendarClock size={12} /> Deadline: {formatDate(item.deadline)}</span>}
              </div>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(250px,320px)', gap: '22px', padding: '22px' }}>
              <div>
                <section style={{ marginBottom: '24px' }}>
                  <h2 style={{ fontSize: '16px', margin: '0 0 8px', color: '#0f172a' }}>About this opportunity</h2>
                  <p style={{ margin: 0, whiteSpace: 'pre-line', color: '#475569', fontSize: '13px', lineHeight: 1.7 }}>
                    {description || 'No detailed description has been provided. Check the organiser’s page for the full announcement.'}
                  </p>
                </section>

                <section style={{ marginBottom: '24px' }}>
                  <h2 style={{ fontSize: '16px', margin: '0 0 8px', color: '#0f172a' }}><Users size={15} style={{ verticalAlign: 'text-bottom', marginRight: 5 }} /> Eligibility</h2>
                  <p style={{ margin: 0, whiteSpace: 'pre-line', color: '#475569', fontSize: '13px', lineHeight: 1.7 }}>
                    {item.eligibility?.trim() || 'Eligibility has not been recorded by EduReach. Confirm the organiser’s requirements before applying.'}
                  </p>
                </section>

                {(item.education_levels?.length || item.disciplines?.length) ? (
                  <section style={{ marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '16px', margin: '0 0 9px', color: '#0f172a' }}>Who this may suit</h2>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                      {(item.education_levels || []).map((value) => <span key={`edu-${value}`} className="er-opp-chip">{value}</span>)}
                      {(item.disciplines || []).map((value) => <span key={`disc-${value}`} className="er-opp-chip">{value}</span>)}
                    </div>
                  </section>
                ) : null}
              </div>

              <aside>
                <div style={{ position: 'sticky', top: '18px', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', background: '#f8fafc' }}>
                  <h2 style={{ margin: '0 0 12px', fontSize: '15px' }}>Application</h2>
                  <a
                    className={status.actionable && item.link_url ? 'hub-primary-btn' : 'hub-outline-btn'}
                    href={item.link_url || '/jobs'}
                    target={item.link_url ? '_blank' : undefined}
                    rel={item.link_url ? 'noopener noreferrer' : undefined}
                    style={{ width: '100%', justifyContent: 'center', textDecoration: 'none', boxSizing: 'border-box', opacity: status.actionable && item.link_url ? 1 : 0.65, pointerEvents: status.actionable && item.link_url ? 'auto' : 'none' }}
                    aria-disabled={!status.actionable || !item.link_url}
                  >
                    {status.actionable && item.link_url ? <>Apply on organiser site <ExternalLink size={14} /></> : <>Application unavailable <ArrowRight size={14} /></>}
                  </a>

                  <dl className="er-opp-facts" style={{ marginTop: '15px' }}>
                    <div><dt>Status</dt><dd>{status.stateLabel}</dd></div>
                    <div><dt>Deadline</dt><dd>{formatDate(item.deadline)}</dd></div>
                    <div><dt>Source</dt><dd>{item.source_name?.trim() || (item.link_url ? 'Organiser’s own page' : 'No source recorded')}</dd></div>
                    <div><dt>Last checked</dt><dd>{status.verifiedOn ? formatDate(status.verifiedOn) : 'Not yet checked by EduReach'}</dd></div>
                  </dl>
                </div>

                <div role="note" style={{ marginTop: '12px', padding: '12px 14px', borderRadius: '10px', border: '1px solid #fde68a', background: '#fffbeb', color: '#854d0e', fontSize: '12px', lineHeight: 1.55 }}>
                  <strong>Apply safely.</strong> EduReach does not guarantee an organiser’s offer. Confirm the deadline, eligibility and any payment request on the source page before submitting personal information.
                </div>

                <div style={{ marginTop: '14px', padding: '12px 14px', borderRadius: '10px', background: '#f8fafc', color: '#475569', fontSize: '12px', lineHeight: 1.55 }}>
                  {verified ? <><CheckCircle2 size={14} style={{ verticalAlign: 'text-bottom', marginRight: 5 }} /> EduReach checked the source on {formatDate(status.verifiedOn)}.</> : 'This listing has not yet been checked by EduReach.'}
                </div>
              </aside>
            </div>
          </article>
        </div>
      </main>
    </HubLayout>
  );
}
