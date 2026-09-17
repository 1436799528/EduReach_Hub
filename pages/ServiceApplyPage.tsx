import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, FileText, UserRound } from 'lucide-react';
import HubLayout from '../src/components/HubLayout';
import { hubServices } from '../src/data/hubContent';
import { submitServiceRequest } from '../src/lib/api';
import { supabase } from '../src/lib/supabase';

type FormState = {
  fullName: string;
  phone: string;
  whatsapp: string;
  institution: string;
  matricNumber: string;
  jambRegNumber: string;
  email: string;
  notes: string;
};

export default function ServiceApplyPage({ slug }: { slug: string }) {
  const service = hubServices.find((item) => item.slug === slug);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState('');
  const [message, setMessage] = useState('');
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [form, setForm] = useState<FormState>({ fullName: '', phone: '', whatsapp: '', institution: '', matricNumber: '', jambRegNumber: '', email: '', notes: '' });

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (active) setSignedIn(Boolean(data.user));
    });
    return () => { active = false; };
  }, []);

  const canNext = useMemo(
    () => step === 1 ? Boolean(form.fullName.trim() && form.phone.trim() && form.whatsapp.trim() && form.institution.trim()) : true,
    [form, step],
  );

  if (!service) return <HubLayout><div className="hub-page"><div className="hub-container hub-narrow"><div className="hub-empty">Service not found.</div></div></div></HubLayout>;

  function update(name: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

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
        serviceSlug: service.slug,
        details: { ...form, serviceTitle: service.title },
      });
      setReference(result.reference_code);
      setMessage('Request submitted successfully.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to submit request.');
    } finally {
      setBusy(false);
    }
  }

  return <HubLayout>
    <div className="hub-page">
      <div className="hub-container hub-narrow">
        <div className="hub-page-title">
          <span className="hub-eyebrow">SERVICE REQUEST</span>
          <h1>{service.title}</h1>
          <p>Complete the form with the details EduReach needs to process your request. Never send passwords, OTPs, card PINs or banking credentials.</p>
        </div>

        {signedIn === false && <div className="hub-panel hub-auth-required">
          <span className="hub-success-icon"><UserRound size={22}/></span>
          <div>
            <span className="hub-eyebrow">ACCOUNT REQUIRED</span>
            <h2>Sign in before submitting a service request.</h2>
            <p>Your request reference and processing history are tied to your EduReach account.</p>
            <div className="hub-wizard-actions"><a className="hub-outline-btn" href="/services"><ArrowLeft size={16}/> Back to services</a><a className="hub-primary-btn" href={`/login?next=${encodeURIComponent(`/services/apply/${service.slug}`)}`}>Sign In <ChevronRight size={16}/></a></div>
          </div>
        </div>}

        {signedIn === true && <>
          <div className="hub-stepper">{[{ n: 1, label: 'Details', icon: UserRound }, { n: 2, label: 'Student data', icon: FileText }, { n: 3, label: 'Review & submit', icon: Check }].map(({ n, label, icon: Icon }) => <div key={n} className={step >= n ? 'active' : ''}><span>{step > n ? <Check size={15}/> : <Icon size={15}/>}</span><strong>{label}</strong></div>)}</div>

          {reference ? <div className="hub-success-panel"><span className="hub-success-icon"><Check size={24}/></span><div><span className="hub-eyebrow">REQUEST RECEIVED</span><h2>{message}</h2><p>Your reference code is <strong>{reference}</strong>. Keep it safe for tracking.</p><div className="hub-wizard-actions"><a className="hub-outline-btn" href="/services">Back to services</a><a className="hub-primary-btn" href={`/services/track?ref=${encodeURIComponent(reference)}`}>Track Request <ChevronRight size={16}/></a></div></div></div> : <form className="hub-panel hub-wizard-panel" onSubmit={next}>
            {step === 1 && <div><h2>Student details</h2><div className="hub-form-grid"><label>Full Name<input value={form.fullName} onChange={(e)=>update('fullName',e.target.value)} autoComplete="name" required /></label><label>Phone Number<input value={form.phone} onChange={(e)=>update('phone',e.target.value)} type="tel" autoComplete="tel" required /></label><label>WhatsApp Number<input value={form.whatsapp} onChange={(e)=>update('whatsapp',e.target.value)} type="tel" required /></label><label>Institution<input value={form.institution} onChange={(e)=>update('institution',e.target.value)} required /></label></div></div>}
            {step === 2 && <div><h2>Student data</h2><div className="hub-form-grid"><label>Matric Number<input value={form.matricNumber} onChange={(e)=>update('matricNumber',e.target.value)} /></label><label>JAMB Registration Number<input value={form.jambRegNumber} onChange={(e)=>update('jambRegNumber',e.target.value)} /></label><label>Email Address<input type="email" value={form.email} onChange={(e)=>update('email',e.target.value)} autoComplete="email" /></label><label className="hub-span-2">Notes<textarea value={form.notes} onChange={(e)=>update('notes',e.target.value)} placeholder="Add any details the support team should know" /></label></div><p className="hub-form-note">Only upload or share information that is necessary for this particular service. Do not include passwords, OTPs or financial credentials.</p></div>}
            {step === 3 && <div><h2>Review request</h2><div className="hub-review-list"><div><span>Service</span><strong>{service.title}</strong></div><div><span>Student</span><strong>{form.fullName}</strong></div><div><span>Institution</span><strong>{form.institution}</strong></div><div><span>Phone</span><strong>{form.phone}</strong></div><div><span>WhatsApp</span><strong>{form.whatsapp}</strong></div><div><span>Email</span><strong>{form.email || 'Not provided'}</strong></div><div><span>Additional notes</span><strong>{form.notes || 'None'}</strong></div></div><div className="hub-payment-box"><Check size={20}/><div><h3>Ready for submission</h3><p>This step records the request in EduReach. Any future paid workflow can be attached to the same request without exposing payment credentials to EduReach.</p></div></div>{message && <div className="hub-form-error">{message}</div>}</div>}
            <div className="hub-wizard-actions">{step > 1 && <button type="button" className="hub-outline-btn" onClick={()=>setStep((value) => value - 1)}><ChevronLeft size={16}/> Back</button>}<span />{step < 3 ? <button type="submit" className="hub-primary-btn" disabled={!canNext}>Continue <ChevronRight size={16}/></button> : <button type="submit" className="hub-primary-btn" disabled={busy}>{busy ? 'Submitting…' : 'Submit Request'} <Check size={16}/></button>}</div>
          </form>}
        </>}
      </div>
    </div>
  </HubLayout>;
}
