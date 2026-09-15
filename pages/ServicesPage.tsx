import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import { services as fallbackServices } from '../src/data/edulebMock';
import { supabase } from '../src/lib/supabase';
import { Shell } from '../src/components/EdulebShared';

type ServiceRow = { id: string; service_key: string; title: string; description: string; application_url: string | null; active: boolean };
type FormData = Record<string, string>;

const serviceMeta: Record<string, { fee: number; badge: string; tone: string; fields: Array<{ key: string; label: string; placeholder: string; type?: string; required?: boolean }> }> = {
  'nelfund-loan': { fee: 2500, badge: 'Active Service', tone: 'service-tint-green', fields: [
    { key: 'fullName', label: 'Full Name', placeholder: 'e.g. John Doe', required: true }, { key: 'phone', label: 'WhatsApp / Phone Number', placeholder: '08012345678', required: true, type: 'tel' }, { key: 'institution', label: 'Institution', placeholder: 'Enter your school', required: true }, { key: 'programme', label: 'Programme', placeholder: 'Enter your programme', required: true }, { key: 'jambReg', label: 'JAMB Reg / Student ID', placeholder: 'Optional' },
  ] },
  results: { fee: 1500, badge: 'WAEC / NECO', tone: 'service-tint-blue', fields: [
    { key: 'fullName', label: 'Full Name', placeholder: 'e.g. John Doe', required: true }, { key: 'phone', label: 'WhatsApp / Phone Number', placeholder: '08012345678', required: true, type: 'tel' }, { key: 'examBody', label: 'Examination Body', placeholder: 'WAEC or NECO', required: true }, { key: 'examNumber', label: 'Examination Number', placeholder: 'Enter examination number', required: true },
  ] },
  'scratch-cards': { fee: 4000, badge: 'Digital Voucher', tone: 'service-tint-amber', fields: [
    { key: 'fullName', label: 'Full Name', placeholder: 'e.g. John Doe', required: true }, { key: 'phone', label: 'WhatsApp / Phone Number', placeholder: '08012345678', required: true, type: 'tel' }, { key: 'examBody', label: 'Examination Body', placeholder: 'WAEC or NECO', required: true }, { key: 'quantity', label: 'Quantity', placeholder: '1', required: true, type: 'number' },
  ] },
  'jamb-slip': { fee: 2000, badge: 'JAMB Support', tone: 'service-tint-blue', fields: [
    { key: 'fullName', label: 'Full Name', placeholder: 'e.g. John Doe', required: true }, { key: 'phone', label: 'WhatsApp / Phone Number', placeholder: '08012345678', required: true, type: 'tel' }, { key: 'jambReg', label: 'JAMB Registration Number', placeholder: 'Enter your JAMB number', required: true }, { key: 'email', label: 'Email Address', placeholder: 'you@example.com', type: 'email', required: true },
  ] },
  'admission-letters': { fee: 2500, badge: 'Admission Support', tone: 'service-tint-green', fields: [
    { key: 'fullName', label: 'Full Name', placeholder: 'e.g. John Doe', required: true }, { key: 'phone', label: 'WhatsApp / Phone Number', placeholder: '08012345678', required: true, type: 'tel' }, { key: 'institution', label: 'Institution', placeholder: 'Enter your school', required: true }, { key: 'requestType', label: 'Request Type', placeholder: 'Deferment or supplementary admission', required: true }, { key: 'reason', label: 'Reason / Details', placeholder: 'Briefly explain your request', required: true },
  ] },
};

export default function ServicesPage() {
  const [catalog, setCatalog] = useState<ServiceRow[]>([]);
  const [selected, setSelected] = useState<ServiceRow | null>(null);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [referenceCode, setReferenceCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void (async () => {
      const [{ data: rows }, { data: auth }] = await Promise.all([
        supabase.from('service_catalog').select('id, service_key, title, description, application_url, active').eq('active', true).order('title'),
        supabase.auth.getUser(),
      ]);
      setCatalog((rows ?? []) as ServiceRow[]);
      setUserId(auth.user?.id ?? null);
    })();
  }, []);

  const services = useMemo(() => catalog.length ? catalog : fallbackServices.map((item) => ({ id: item.id, service_key: item.id, title: item.title, description: item.description, application_url: null, active: true })), [catalog]);
  const meta = selected ? serviceMeta[selected.service_key] : null;

  function choose(service: ServiceRow) { setSelected(service); setStep(1); setFormData({}); setError(''); setReferenceCode(''); }

  function next(event: FormEvent) {
    event.preventDefault();
    if (!userId) { setError('Please sign in before submitting a service request.'); return; }
    setError(''); setStep(2);
  }

  async function submitRequest() {
    if (!selected || !userId) { setError('Please sign in before submitting a service request.'); return; }
    setSubmitting(true); setError('');
    const { data, error: requestError } = await supabase.from('service_requests').insert({ user_id: userId, service_id: selected.id, status: 'submitted', form_data: formData }).select('reference_code').single();
    setSubmitting(false);
    if (requestError) { setError(requestError.message); return; }
    setReferenceCode(data.reference_code); setStep(3);
  }

  return (
    <Shell title="Services">
      <section className="course_area section-padding"><div className="container">
        {!selected ? <>
          <div className="section-title text-center"><h2>Digital Portal &amp; Student Assistance Services</h2><p>Select a service to start a request with live status tracking.</p></div>
          <div className="row">{services.map((service) => { const info = serviceMeta[service.service_key]; return <div className="col-lg-4 col-md-6 col-sm-6" key={service.id}><div className={`service-wizard-card ${info?.tone ?? 'service-tint-blue'}`}><div className="service-wizard-top"><span>{info?.badge ?? 'EduReach Service'}</span><strong>₦{(info?.fee ?? 0).toLocaleString()}</strong></div><h3>{service.title}</h3><p>{service.description}</p><button className="btn_one service-apply-btn" onClick={() => choose(service)}>Apply Now <ArrowRight size={15} /></button></div></div>; })}</div>
        </> : <div className="service-wizard-shell">
          <div className="service-wizard-header"><div><span>Step {step > 2 ? 2 : step} of 2</span><h2>{selected.title}</h2></div><button onClick={() => setSelected(null)}>Change Service</button></div>
          {step === 1 && meta && <form onSubmit={next} className="service-wizard-form">{meta.fields.map((field) => <div key={field.key}><label htmlFor={field.key}>{field.label}</label><input id={field.key} type={field.type ?? 'text'} required={field.required} placeholder={field.placeholder} value={formData[field.key] ?? ''} onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })} /></div>)}{error && <div className="form-error">{error}</div>}<button className="hub-primary-btn" type="submit">Proceed to Summary <ArrowRight size={16} /></button></form>}
          {step === 2 && <div className="service-summary"><div className="service-summary-box"><div><span>Service</span><strong>{selected.title}</strong></div><div><span>Applicant</span><strong>{formData.fullName}</strong></div><div><span>Phone</span><strong>{formData.phone}</strong></div><div className="service-total"><span>Total Payable</span><strong>₦{(meta?.fee ?? 0).toLocaleString()}</strong></div></div><p className="service-security-note"><ShieldCheck size={17} /> Final payment integration will be connected to the approved payment provider. Do not send passwords, OTPs or card PINs here.</p>{error && <div className="form-error">{error}</div>}<div className="service-wizard-actions"><button className="hub-secondary-btn" onClick={() => setStep(1)}><ArrowLeft size={15} /> Back</button><button className="hub-primary-btn" disabled={submitting} onClick={submitRequest}><CheckCircle2 size={15} /> {submitting ? 'Submitting…' : 'Submit Request'}</button></div></div>}
          {step === 3 && <div className="service-success-panel"><CheckCircle2 size={44} /><h2>Request Submitted</h2><p>Your EduReach service request has been saved.</p><div className="reference-code">{referenceCode}</div><p>Keep this reference code to track your request.</p><a href={`/services/track?ref=${encodeURIComponent(referenceCode)}`} className="btn_one">Track Request</a><button className="hub-text-btn" onClick={() => setSelected(null)}>Return to Services</button></div>}
        </div>}
      </div></section>
    </Shell>
  );
}
