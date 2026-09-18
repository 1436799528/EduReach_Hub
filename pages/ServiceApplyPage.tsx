import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, ExternalLink, FileText, UserRound } from 'lucide-react';
import HubLayout from '../src/components/HubLayout';
import { fetchService, submitServiceRequest, type ServiceItem } from '../src/lib/api';
import { supabase } from '../src/lib/supabase';

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
      .then((item) => { if (active) setService(item); })
      .catch((value) => { if (active) setServiceError(value instanceof Error ? value.message : 'Unable to load this service.'); })
      .finally(() => { if (active) setServiceLoading(false); });
    void supabase.auth.getUser().then(({ data }) => {
      if (active && data.user) {
        setSignedIn(true);
        setForm((current) => ({ ...current, email: data.user.email || '' }));
        void supabase.from('profiles').select('full_name,school,matric_number,phone,jamb_reg_no').eq('id', data.user.id).maybeSingle().then(({ data: profile }) => {
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
    return () => { active = false; };
  }, [slug]);

  const canNext = useMemo(
    () => step !== 1 || Boolean(form.fullName.trim() && form.phone.trim() && form.institution.trim()),
    [form, step],
  );

  if (serviceLoading) return <HubLayout><div className="hub-page"><div className="hub-container hub-narrow"><div className="hub-panel hub-empty">Loading service…</div></div></div></HubLayout>;
  if (serviceError || !service) return <HubLayout><div className="hub-page"><div className="hub-container hub-narrow"><div className="hub-panel hub-empty">{serviceError || 'Service not found.'}<div className="hub-wizard-actions"><a className="hub-outline-btn" href="/services"><ArrowLeft size={16}/> Services</a></div></div></div></div></HubLayout>;

  const variant = fieldsFor(service.service_key);

  function update(name: keyof FormState, value: string) { setForm((current) => ({ ...current, [name]: value })); }

  function next(event: FormEvent) {
    event.preventDefault();
    if (step < 3) setStep((value) => value + 1);
    else void handleSubmit();
  }

  async function handleSubmit() {
    setBusy(true);
    setMessage('');
    try {
      const result = await submitServiceRequest({
        serviceSlug: service.service_key,
        details: { ...form, serviceTitle: service.title },
      });
      setReference(result.reference_code);
      setMessage('Request submitted.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to submit request.');
    } finally {
      setBusy(false);
    }
  }

  return <HubLayout><div className="hub-page"><div className="hub-container hub-narrow">
    <div className="hub-section-heading hub-page-heading-compact"><div><span className="hub-eyebrow">REQUEST</span><h1>{service.title}</h1></div>{service.application_url && <a className="hub-outline-btn" href={service.application_url} target="_blank" rel="noreferrer">Official Portal <ExternalLink size={15}/></a>}</div>
    <div className="hub-request-summary"><span>{service.description}</span><small>Request data is stored against your EduReach account.</small></div>

    {signedIn === false && <div className="hub-panel hub-auth-required"><span className="hub-success-icon"><UserRound size={22}/></span><div><span className="hub-eyebrow">ACCOUNT REQUIRED</span><h2>Sign in to submit.</h2><div className="hub-wizard-actions"><a className="hub-outline-btn" href="/services"><ArrowLeft size={16}/> Services</a><a className="hub-primary-btn" href={`/login?next=${encodeURIComponent(`/services/apply/${service.service_key}`)}`}>Sign In <ChevronRight size={16}/></a></div></div></div>}

    {signedIn === null && <div className="hub-panel hub-empty">Checking account…</div>}

    {signedIn === true && <>{!reference ? <form className="hub-panel hub-wizard-panel" onSubmit={next}>
      <div className="hub-stepper">{[{n:1,label:'Student'}, {n:2,label:'Service'}, {n:3,label:'Review'}].map(({n,label}) => <div key={n} className={step >= n ? 'active' : ''}><span>{step > n ? <Check size={15}/> : n}</span><strong>{label}</strong></div>)}</div>
      {step === 1 && <div><h2>Student details</h2><div className="hub-form-grid"><label>Full Name<input value={form.fullName} onChange={(e)=>update('fullName',e.target.value)} autoComplete="name" required /></label><label>Phone<input value={form.phone} onChange={(e)=>update('phone',e.target.value)} type="tel" required /></label><label>WhatsApp<input value={form.whatsapp} onChange={(e)=>update('whatsapp',e.target.value)} type="tel" /></label><label>Institution<input value={form.institution} onChange={(e)=>update('institution',e.target.value)} required /></label><label>Matric Number<input value={form.matricNumber} onChange={(e)=>update('matricNumber',e.target.value)} /></label><label>JAMB Registration Number<input value={form.jambRegNumber} onChange={(e)=>update('jambRegNumber',e.target.value)} /></label></div></div>}
      {step === 2 && <div><h2>{variant.extra === 'results' ? 'Result details' : variant.extra === 'cards' ? 'Card details' : variant.extra === 'jamb' ? 'JAMB details' : variant.extra === 'admission' ? 'Admission request' : 'Request details'}</h2><div className="hub-form-grid"><label>Email<input type="email" value={form.email} onChange={(e)=>update('email',e.target.value)} autoComplete="email" /></label>
        {(variant.extra === 'results' || variant.extra === 'cards') && <label>Examination Body<select value={form.examBody} onChange={(e)=>update('examBody',e.target.value)}><option value="">Select</option><option value="WAEC">WAEC</option><option value="NECO">NECO</option></select></label>}
        {variant.extra === 'results' && <label>Candidate / Examination Number<input value={form.candidateNumber} onChange={(e)=>update('candidateNumber',e.target.value)} /></label>}
        {variant.extra === 'cards' && <label>Quantity<input type="number" min="1" max="10" value={form.quantity} onChange={(e)=>update('quantity',e.target.value)} /></label>}
        {variant.extra === 'jamb' && <label>JAMB Registration Number<input value={form.jambRegNumber} onChange={(e)=>update('jambRegNumber',e.target.value)} /></label>}
        {variant.extra === 'admission' && <label>Request Type<select value={form.requestType} onChange={(e)=>update('requestType',e.target.value)}><option value="">Select</option><option>Admission Deferment</option><option>Supplementary Admission</option></select></label>}
        <label className="hub-span-2">Notes<textarea value={form.notes} onChange={(e)=>update('notes',e.target.value)} placeholder="Add any details needed for this request" /></label>
      </div><p className="hub-form-note">Do not enter passwords, OTPs, card PINs or banking credentials.</p></div>}
      {step === 3 && <div><h2>Review</h2><div className="hub-review-list"><div><span>Service</span><strong>{service.title}</strong></div><div><span>Student</span><strong>{form.fullName}</strong></div><div><span>Institution</span><strong>{form.institution}</strong></div><div><span>Phone</span><strong>{form.phone}</strong></div><div><span>Email</span><strong>{form.email || 'Not provided'}</strong></div><div><span>Service notes</span><strong>{form.notes || 'None'}</strong></div></div></div>}
      {message && <div className="hub-form-error">{message}</div>}
      <div className="hub-wizard-actions">{step > 1 && <button type="button" className="hub-outline-btn" onClick={()=>setStep((value)=>value-1)}><ChevronLeft size={16}/> Back</button>}<span />{step < 3 ? <button type="submit" className="hub-primary-btn" disabled={!canNext}>Continue <ChevronRight size={16}/></button> : <button type="submit" className="hub-primary-btn" disabled={busy}>{busy ? 'Submitting…' : 'Submit Request'} <Check size={16}/></button>}</div>
    </form> : <div className="hub-success-panel"><span className="hub-success-icon"><Check size={24}/></span><div><span className="hub-eyebrow">REQUEST RECEIVED</span><h2>{message}</h2><p>Reference: <strong>{reference}</strong></p><div className="hub-wizard-actions"><a className="hub-outline-btn" href="/services">Services</a><a className="hub-primary-btn" href="/news">Campus Updates <ChevronRight size={16}/></a></div></div></div>}</>}
  </div></div></HubLayout>;
}
