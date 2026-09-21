import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Search,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import HubLayout from '../src/components/HubLayout';
import CardIdentityMark from '../src/components/CardIdentityMark';
import { fetchService, submitServiceRequest, type ServiceItem } from '../src/lib/api';
import { isSupabaseConfigured, supabase } from '../src/lib/supabase';
import { useAuth } from '../src/lib/auth';

const EDUReachWhatsApp = '2349130134969';

type FormState = {
  fullName: string;
  phone: string;
  whatsapp: string;
  institution: string;
  matricNumber: string;
  jambRegNumber: string;
  email: string;
  examBody: string;
  candidateNumber: string;
  quantity: string;
  requestType: string;
  notes: string;
};

type ProfileRow = {
  full_name: string;
  school: string;
  matric_number: string | null;
  phone: string | null;
  jamb_reg_no: string | null;
};

const emptyForm: FormState = {
  fullName: '',
  phone: '',
  whatsapp: '',
  institution: '',
  matricNumber: '',
  jambRegNumber: '',
  email: '',
  examBody: '',
  candidateNumber: '',
  quantity: '1',
  requestType: '',
  notes: '',
};

function fieldsFor(serviceKey: string) {
  if (serviceKey === 'results') return { extra: 'results' as const };
  if (serviceKey === 'scratch-cards') return { extra: 'cards' as const };
  if (serviceKey === 'jamb-slip') return { extra: 'jamb' as const };
  if (serviceKey === 'admission-letters') return { extra: 'admission' as const };
  return { extra: 'nelfund' as const };
}

export default function ServiceApplyPage({ slug }: { slug: string }) {
  const { isAuthenticated, user: authUser } = useAuth();
  const [service, setService] = useState<ServiceItem | null>(null);
  const [serviceLoading, setServiceLoading] = useState(true);
  const [serviceError, setServiceError] = useState('');
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState('');
  const [message, setMessage] = useState('');
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    let active = true;
    void fetchService(slug)
      .then((item) => {
        if (active) setService(item);
      })
      .catch((value) => {
        if (active) setServiceError(value instanceof Error ? value.message : 'Unable to load this service.');
      })
      .finally(() => {
        if (active) setServiceLoading(false);
      });

    if (!isSupabaseConfigured) {
      setSignedIn(isAuthenticated);
      if (authUser?.email) setForm((current) => ({ ...current, email: current.email || authUser.email }));
      return () => {
        active = false;
      };
    }

    void supabase.auth.getUser().then(({ data }) => {
      if (active && data.user) {
        setSignedIn(true);
        setForm((current) => ({ ...current, email: data.user.email || '' }));
        void supabase
          .from('profiles')
          .select('full_name,school,matric_number,phone,jamb_reg_no')
          .eq('id', data.user.id)
          .maybeSingle()
          .then(({ data: profile }) => {
            if (!active || !profile) return;
            const row = profile as ProfileRow;
            setForm((current) => ({
              ...current,
              fullName: current.fullName || row.full_name || '',
              phone: current.phone || row.phone || '',
              whatsapp: current.whatsapp || row.phone || '',
              institution: current.institution || row.school || '',
              matricNumber: current.matricNumber || row.matric_number || '',
              jambRegNumber: current.jambRegNumber || row.jamb_reg_no || '',
            }));
          });
      } else if (active) {
        setSignedIn(false);
      }
    });
    return () => {
      active = false;
    };
  }, [authUser?.email, isAuthenticated, slug]);

  const canNext = useMemo(
    () => step !== 1 || Boolean(form.fullName.trim() && form.phone.trim() && form.institution.trim()),
    [form, step],
  );

  if (serviceLoading)
    return (
      <HubLayout>
        <div className="hub-page">
          <div className="hub-container hub-narrow">
            <div className="hub-panel hub-empty">Loading service details…</div>
          </div>
        </div>
      </HubLayout>
    );

  if (serviceError || !service)
    return (
      <HubLayout>
        <div className="hub-page">
          <div className="hub-container hub-narrow">
            <div className="hub-panel hub-empty">
              {serviceError || 'Service not found.'}
              <div className="hub-wizard-actions" style={{ marginTop: '14px' }}>
                <a className="hub-outline-btn" href="/services">
                  <ArrowLeft size={16} /> All Services
                </a>
              </div>
            </div>
          </div>
        </div>
      </HubLayout>
    );

  const variant = fieldsFor(service.service_key);

  function update(name: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function next(event: FormEvent) {
    event.preventDefault();
    if (isSupabaseConfigured && !isAuthenticated) {
      setMessage('Please sign in before submitting this service request.');
      return;
    }
    if (step < 3) setStep((value) => value + 1);
    else void handleSubmit();
  }

  async function handleSubmit() {
    setBusy(true);
    setMessage('');
    try {
      const result = await submitServiceRequest({
        serviceSlug: service!.service_key,
        details: { ...form, serviceTitle: service!.title },
      });
      setReference(result.reference_code);
      setMessage('Your service request was successfully submitted. Redirecting to WhatsApp…');
      const whatsappText = [
        'Hello EduReach, I just submitted a service request.',
        `Service: ${service!.title}`,
        `Reference code: ${result.reference_code}`,
        `Name: ${form.fullName}`,
        `WhatsApp: ${form.whatsapp || form.phone}`,
        'Please assist me with this request.',
      ].join('\\n');
      window.setTimeout(() => {
        window.location.assign(`https://wa.me/${EDUReachWhatsApp}?text=${encodeURIComponent(whatsappText)}`);
      }, 700);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to submit request.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <HubLayout>
      <div className="hub-page" style={{ padding: '24px 0 60px' }}>
        <div className="hub-container" style={{ maxWidth: '760px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <CardIdentityMark value={service.service_key + ' ' + service.title} type="service" size="sm" />
              <h1 style={{ fontSize: '19px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                {service.title}
              </h1>
            </div>
            {service.application_url && (
              <a className="hub-outline-btn" href={service.application_url} target="_blank" rel="noreferrer" style={{ fontSize: '11px', padding: '5px 9px' }}>
                Official Portal <ExternalLink size={12} />
              </a>
            )}
          </div>

          {/* SESSION BANNER */}
          {signedIn === false && !reference && (
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '12px 16px',
                marginBottom: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
                fontSize: '12px',
                color: '#475569',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={16} color="#059669" />
                <span>
                  {isSupabaseConfigured ? (
                    <><strong>Sign-in required:</strong> Submit from your student account so the request is linked to your dashboard.</>
                  ) : (
                    <><strong>Local account session:</strong> Requests are saved in this browser until production auth is configured.</>
                  )}
                </span>
              </div>
              <a
                href={`/login?next=${encodeURIComponent(`/services/apply/${service.service_key}`)}`}
                style={{ color: '#D9381E', fontWeight: 800, textDecoration: 'none' }}
              >
                Sign in to link account →
              </a>
            </div>
          )}

          {!reference ? (
            <form className="hub-panel hub-wizard-panel" onSubmit={next} style={{ padding: '24px' }}>
              {/* STEPPER */}
              <div className="hub-stepper" style={{ marginBottom: '24px' }}>
                {[
                  { n: 1, label: 'Student Bio' },
                  { n: 2, label: 'Request Data' },
                  { n: 3, label: 'Confirmation' },
                ].map(({ n, label }) => (
                  <div key={n} className={step >= n ? 'active' : ''}>
                    <span>{step > n ? <Check size={14} /> : n}</span>
                    <strong>{label}</strong>
                  </div>
                ))}
              </div>

              {/* STEP 1: STUDENT DETAILS */}
              {step === 1 && (
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 16px', color: '#0f172a' }}>
                    Student Identification
                  </h2>
                  <div className="hub-form-grid">
                    <label>
                      Full Name *
                      <input
                        value={form.fullName}
                        onChange={(e) => update('fullName', e.target.value)}
                        placeholder="e.g. Ibrahim Abubakar"
                        autoComplete="name"
                        required
                      />
                    </label>
                    <label>
                      Phone Number *
                      <input
                        value={form.phone}
                        onChange={(e) => update('phone', e.target.value)}
                        placeholder="e.g. 08012345678"
                        type="tel"
                        required
                      />
                    </label>
                    <label>
                      WhatsApp Number
                      <input
                        value={form.whatsapp}
                        onChange={(e) => update('whatsapp', e.target.value)}
                        placeholder="e.g. 08012345678"
                        type="tel"
                      />
                    </label>
                    <label>
                      Institution Name *
                      <input
                        value={form.institution}
                        onChange={(e) => update('institution', e.target.value)}
                        placeholder="e.g. University of Lagos / UNIPORT"
                        required
                      />
                    </label>
                    <label>
                      Matriculation / Application No.
                      <input
                        value={form.matricNumber}
                        onChange={(e) => update('matricNumber', e.target.value)}
                        placeholder="e.g. 210805012 (Optional)"
                      />
                    </label>
                    <label>
                      JAMB Registration Number
                      <input
                        value={form.jambRegNumber}
                        onChange={(e) => update('jambRegNumber', e.target.value)}
                        placeholder="e.g. 202410294821BF (Optional)"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* STEP 2: SERVICE-SPECIFIC DETAILS */}
              {step === 2 && (
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 16px', color: '#0f172a' }}>
                    {variant.extra === 'results'
                      ? 'Result Verification Details'
                      : variant.extra === 'cards'
                      ? 'Scratch Card Order'
                      : variant.extra === 'jamb'
                      ? 'JAMB Portal Specifics'
                      : variant.extra === 'admission'
                      ? 'Admission Request Details'
                      : 'Application Specifics'}
                  </h2>
                  <div className="hub-form-grid">
                    <label>
                      Email Address (for dispatch)
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => update('email', e.target.value)}
                        placeholder="candidate@example.com"
                        autoComplete="email"
                      />
                    </label>
                    {(variant.extra === 'results' || variant.extra === 'cards') && (
                      <label>
                        Examination Body
                        <select value={form.examBody} onChange={(e) => update('examBody', e.target.value)}>
                          <option value="">Select Examination Body</option>
                          <option value="WAEC">WAEC (West African Exams Council)</option>
                          <option value="NECO">NECO (National Exams Council)</option>
                          <option value="NABTEB">NABTEB</option>
                        </select>
                      </label>
                    )}
                    {variant.extra === 'results' && (
                      <label>
                        Candidate Examination Number
                        <input
                          value={form.candidateNumber}
                          onChange={(e) => update('candidateNumber', e.target.value)}
                          placeholder="e.g. 4120934021"
                        />
                      </label>
                    )}
                    {variant.extra === 'cards' && (
                      <label>
                        Quantity Required
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={form.quantity}
                          onChange={(e) => update('quantity', e.target.value)}
                        />
                      </label>
                    )}
                    {variant.extra === 'admission' && (
                      <label>
                        Admission Request Type
                        <select value={form.requestType} onChange={(e) => update('requestType', e.target.value)}>
                          <option value="">Select Request Type</option>
                          <option>Admission Regularization</option>
                          <option>Admission Deferment</option>
                          <option>Supplementary Admission Clearance</option>
                          <option>Change of Course / Institution Verification</option>
                        </select>
                      </label>
                    )}
                    <label className="hub-span-2">
                      Additional Processing Instructions
                      <textarea
                        value={form.notes}
                        onChange={(e) => update('notes', e.target.value)}
                        placeholder="Add any specific details, previous registration attempts, or special requirements"
                        rows={3}
                      />
                    </label>
                  </div>
                  <p className="hub-form-note" style={{ marginTop: '12px' }}>
                    🔒 Notice: EduReach will never ask for your private banking PIN or confidential passwords.
                  </p>
                </div>
              )}

              {/* STEP 3: REVIEW */}
              {step === 3 && (
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 16px', color: '#0f172a' }}>
                    Review Application Summary
                  </h2>
                  <div className="hub-review-list">
                    <div>
                      <span>Requested Service</span>
                      <strong>{service.title}</strong>
                    </div>
                    <div>
                      <span>Applicant Name</span>
                      <strong>{form.fullName}</strong>
                    </div>
                    <div>
                      <span>Institution</span>
                      <strong>{form.institution}</strong>
                    </div>
                    <div>
                      <span>Phone &amp; WhatsApp</span>
                      <strong>
                        {form.phone} {form.whatsapp ? `/ ${form.whatsapp}` : ''}
                      </strong>
                    </div>
                    <div>
                      <span>Notification Email</span>
                      <strong>{form.email || 'None specified'}</strong>
                    </div>
                    {form.matricNumber && (
                      <div>
                        <span>Matric / Reg No</span>
                        <strong>{form.matricNumber}</strong>
                      </div>
                    )}
                    {form.notes && (
                      <div>
                        <span>Instructions</span>
                        <strong>{form.notes}</strong>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {message && <div className="hub-form-error" style={{ marginTop: '14px' }}>{message}</div>}

              {/* BUTTON ACTIONS */}
              <div className="hub-wizard-actions" style={{ marginTop: '24px' }}>
                {step > 1 ? (
                  <button type="button" className="hub-outline-btn" onClick={() => setStep((value) => value - 1)}>
                    <ChevronLeft size={16} /> Previous
                  </button>
                ) : (
                  <a className="hub-outline-btn" href="/services" style={{ textDecoration: 'none' }}>
                    <ArrowLeft size={15} /> All Services
                  </a>
                )}
                <span />
                {step < 3 ? (
                  <button type="submit" className="hub-primary-btn" disabled={!canNext}>
                    Continue <ChevronRight size={16} />
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="hub-primary-btn"
                    style={{ background: '#D9381E' }}
                    disabled={busy}
                  >
                    {busy ? 'Submitting…' : 'Confirm & Submit'} <Check size={16} />
                  </button>
                )}
              </div>
            </form>
          ) : (
            /* SUCCESS CONFIRMATION PANEL */
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #a7f3d0',
                borderRadius: '16px',
                padding: '32px',
                textAlign: 'center',
                boxShadow: '0 10px 30px rgba(5, 150, 105, 0.08)',
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: '#ecfdf5',
                  color: '#059669',
                  display: 'grid',
                  placeItems: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <CheckCircle2 size={32} />
              </div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  color: '#059669',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                REQUEST CONFIRMED
              </span>
              <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', margin: '4px 0 8px' }}>
                Application Successfully Logged
              </h2>
              <p style={{ fontSize: '14px', color: '#475569', margin: '0 0 20px', maxWidth: '500px', marginInline: 'auto' }}>
                Your request has been registered in the EduReach academic queue. Save your tracking reference code below to check verification milestones.
              </p>

              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: '#f8fafc',
                  border: '2px dashed #059669',
                  padding: '12px 24px',
                  borderRadius: '12px',
                  margin: '0 auto 24px',
                }}
              >
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>REFERENCE CODE:</span>
                <strong style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', letterSpacing: '0.06em' }}>
                  {reference}
                </strong>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <a
                  className="hub-primary-btn"
                  href={isAuthenticated ? `/dashboard/services?ref=${encodeURIComponent(reference)}` : `/track?ref=${encodeURIComponent(reference)}`}
                  style={{ textDecoration: 'none', background: '#D9381E' }}
                >
                  <Search size={15} /> Track Application Status
                </a>
                <a className="hub-outline-btn" href="/services" style={{ textDecoration: 'none' }}>
                  Return to Catalog
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </HubLayout>
  );
}
