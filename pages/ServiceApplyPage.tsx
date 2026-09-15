import { FormEvent, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, CreditCard, FileUp, UserRound } from 'lucide-react';
import HubLayout from '../src/components/HubLayout';
import { hubServices } from '../src/data/hubContent';
import { submitServiceRequest } from '../src/lib/api';

export default function ServiceApplyPage({ slug }: { slug: string }) {
  const service = hubServices.find((item) => item.slug === slug);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ fullName: '', phone: '', whatsapp: '', institution: '', matricNumber: '', jambRegNumber: '', email: '', notes: '' });

  const canNext = useMemo(() => step === 1 ? !!(form.fullName && form.phone && form.whatsapp && form.institution) : true, [form, step]);
  if (!service) return <HubLayout><div className="hub-page"><div className="hub-container hub-narrow"><div className="hub-empty">Service not found.</div></div></div></HubLayout>;

  function update(name: keyof typeof form, value: string) { setForm((current) => ({ ...current, [name]: value })); }
  function submit(event: FormEvent) { event.preventDefault(); if (step < 3) { setStep(step + 1); return; } handleSubmit(); }

  async function handleSubmit() {
    setBusy(true); setMessage('');
    try {
      const result = await submitServiceRequest({ serviceSlug: service.slug, details: { ...form, serviceTitle: service.title } });
      setReference(`ER-${new Date().getFullYear()}-${result.id.slice(0, 4).toUpperCase()}`);
      setMessage('Request submitted successfully.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to submit request.');
    } finally { setBusy(false); }
  }

  return <HubLayout><div className="hub-page"><div className="hub-container hub-narrow">
    <div className="hub-page-title"><span className="hub-eyebrow">SERVICE WIZARD</span><h1>{service.title}</h1><p>Complete the three steps. Payment integration is ready to connect to Paystack on the backend.</p></div>
    <div className="hub-stepper">{[{n:1,label:'Details',icon:UserRound},{n:2,label:'Documents / Data',icon:FileUp},{n:3,label:'Payment',icon:CreditCard}].map(({n,label,icon:Icon}) => <div key={n} className={step >= n ? 'active' : ''}><span>{step > n ? <Check size={15}/> : n}</span><strong>{label}</strong></div>)}</div>
    {reference ? <div className="hub-success-panel"><span className="hub-success-icon"><Check size={24}/></span><div><span className="hub-eyebrow">REQUEST RECEIVED</span><h2>{message}</h2><p>Your reference code is <strong>{reference}</strong>. Keep it safe for tracking.</p><a className="hub-primary-btn" href="/services/track">Track Request</a></div></div> : <form className="hub-panel hub-wizard-panel" onSubmit={submit}>
      {step === 1 && <div><h2>Student details</h2><div className="hub-form-grid"><label>Full Name<input value={form.fullName} onChange={(e)=>update('fullName',e.target.value)} required /></label><label>Phone Number<input value={form.phone} onChange={(e)=>update('phone',e.target.value)} required /></label><label>WhatsApp Number<input value={form.whatsapp} onChange={(e)=>update('whatsapp',e.target.value)} required /></label><label>Institution<input value={form.institution} onChange={(e)=>update('institution',e.target.value)} required /></label></div></div>}
      {step === 2 && <div><h2>Documents / student data</h2><div className="hub-form-grid"><label>Matric Number<input value={form.matricNumber} onChange={(e)=>update('matricNumber',e.target.value)} /></label><label>JAMB Registration Number<input value={form.jambRegNumber} onChange={(e)=>update('jambRegNumber',e.target.value)} /></label><label>Email Address<input type="email" value={form.email} onChange={(e)=>update('email',e.target.value)} /></label><label>Attachment<input type="file" /></label><label className="hub-span-2">Notes<textarea value={form.notes} onChange={(e)=>update('notes',e.target.value)} placeholder="Add any details the support team should know" /></label></div><p className="hub-form-note">Do not upload passwords, OTPs, card PINs or banking passwords.</p></div>}
      {step === 3 && <div><h2>Payment & submission</h2><div className="hub-payment-summary"><div><span>Service</span><strong>{service.title}</strong></div><div><span>Fee</span><strong>To be confirmed by backend</strong></div></div><div className="hub-payment-box"><CreditCard size={22}/><div><h3>Paystack integration point</h3><p>The frontend button is ready for the payment reference returned by the backend.</p></div></div>{message && <div className="hub-form-error">{message}</div>}</div>}
      <div className="hub-wizard-actions">{step > 1 && <button type="button" className="hub-outline-btn" onClick={()=>setStep(step - 1)}><ChevronLeft size={16}/> Back</button>}<span />{step < 3 ? <button type="submit" className="hub-primary-btn" disabled={!canNext}>Continue <ChevronRight size={16}/></button> : <button type="submit" className="hub-primary-btn" disabled={busy}>{busy ? 'Submitting…' : 'Pay & Submit Request'}</button>}</div>
    </form>}
  </div></div></HubLayout>;
}
