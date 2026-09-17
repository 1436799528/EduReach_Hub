import { FormEvent, useMemo, useState } from 'react';
import { services } from '../src/data/edulebMock';
import { Shell } from '../src/components/EdulebShared';
import AuthModal from '../src/components/AuthModal';
import { supabase } from '../src/lib/supabase';

type Detail = {
  overview: string;
  steps: string[];
  requirements: string[];
  notes: string[];
  fields: Array<{ name: string; label: string; type?: string; placeholder: string; required?: boolean }>;
};

const details: Record<string, Detail> = {
  'nelfund-loan': {
    overview: 'EduReach helps students organise the information they need before starting a NELFUND student loan request.',
    steps: ['Confirm the current NELFUND application window and eligibility requirements.', 'Prepare your personal, institution and academic information.', 'Send your support request through EduReach, then complete the final application on the official NELFUND portal.'],
    requirements: ['Student identification and contact details', 'Institution and programme information', 'Valid banking information where required', 'Any supporting information requested by the official portal'],
    notes: ['Requirements and application windows can change.', 'EduReach does not replace the official NELFUND portal.', 'Do not send passwords, OTPs or card PINs through this form.'],
    fields: [
      { name: 'fullName', label: 'Full Name', placeholder: 'Enter your full name', required: true },
      { name: 'email', label: 'Email Address', type: 'email', placeholder: 'Enter your email', required: true },
      { name: 'institution', label: 'Institution', placeholder: 'Enter your school', required: true },
      { name: 'programme', label: 'Programme', placeholder: 'Enter your programme', required: true },
      { name: 'message', label: 'What do you need help with?', placeholder: 'Tell us exactly what you need help with', required: true },
    ],
  },
  results: {
    overview: 'Get guided support for checking WAEC or NECO results and keeping your result details secure.',
    steps: ['Identify whether you are checking a WAEC or NECO result.', 'Prepare the candidate or examination details required by the official checker.', 'Use EduReach for guidance, then complete the final check on the official result-checking channel.'],
    requirements: ['Examination body', 'Candidate details or examination number', 'Result-checking PIN or token when officially required'],
    notes: ['Do not post result PINs or tokens in public spaces.', 'Always complete final result verification on the official result-checking channel.'],
    fields: [
      { name: 'fullName', label: 'Full Name', placeholder: 'Enter your full name', required: true },
      { name: 'examBody', label: 'Examination Body', placeholder: 'WAEC or NECO', required: true },
      { name: 'examNumber', label: 'Examination Number', placeholder: 'Enter your examination number', required: true },
      { name: 'message', label: 'What do you need help with?', placeholder: 'Checking result, understanding a result, etc.', required: true },
    ],
  },
  'scratch-cards': {
    overview: 'Understand which WAEC or NECO result-checking card you need before you buy or activate one.',
    steps: ['Select the examination body you need.', 'Confirm the correct card or token type before payment.', 'Keep the PIN private and only use it on the correct official result-checking service.'],
    requirements: ['Examination body', 'Correct card type', 'Secure payment method if purchasing through an approved seller'],
    notes: ['Never share a scratch-card PIN publicly.', 'Confirm the examination body before buying a card.'],
    fields: [
      { name: 'fullName', label: 'Full Name', placeholder: 'Enter your full name', required: true },
      { name: 'examBody', label: 'Examination Body', placeholder: 'WAEC or NECO', required: true },
      { name: 'quantity', label: 'Quantity', type: 'number', placeholder: '1', required: true },
      { name: 'message', label: 'Request Details', placeholder: 'Tell us what card support you need', required: true },
    ],
  },
  'jamb-slip': {
    overview: 'EduReach provides structured help for locating, reviewing and printing your JAMB examination slip.',
    steps: ['Confirm your JAMB profile and candidate details.', 'Locate the examination slip attached to your candidate record.', 'Print or save the slip and verify the date, centre and candidate information.'],
    requirements: ['JAMB registration details', 'Access to the email or profile used for the registration', 'Printer or a device for saving the slip as a PDF'],
    notes: ['Recheck your examination date and centre before examination day.', 'Keep a digital copy and a printed copy where possible.'],
    fields: [
      { name: 'fullName', label: 'Full Name', placeholder: 'Enter your full name', required: true },
      { name: 'jambNumber', label: 'JAMB Registration Number', placeholder: 'Enter your JAMB registration number', required: true },
      { name: 'email', label: 'Email Address', type: 'email', placeholder: 'Enter your email', required: true },
      { name: 'message', label: 'What do you need help with?', placeholder: 'Printing, locating, or checking your slip', required: true },
    ],
  },
  'admission-letters': {
    overview: 'Get structured help preparing admission deferment and supplementary application letters without inventing official requirements.',
    steps: ['Confirm your institution and the admission situation.', 'Write down the exact reason and facts that support the request.', 'Submit the final letter through the process required by your institution.'],
    requirements: ['Institution name', 'Admission or application details', 'Reason for the request', 'Any supporting documents required by the institution'],
    notes: ['Institutional procedures differ.', 'EduReach provides structure and guidance; the institution decides what is accepted.'],
    fields: [
      { name: 'fullName', label: 'Full Name', placeholder: 'Enter your full name', required: true },
      { name: 'institution', label: 'Institution', placeholder: 'Enter your school', required: true },
      { name: 'requestType', label: 'Request Type', placeholder: 'Deferment or supplementary admission', required: true },
      { name: 'message', label: 'Reason / Details', placeholder: 'Explain the situation and what you are requesting', required: true },
    ],
  },
};

export default function ServiceDetailsPage({ id }: { id: string }) {
  const service = services.find((item) => item.id === id) ?? services[0];
  const detail = details[service.id];
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [requestId, setRequestId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | null>(null);

  const title = useMemo(() => service.title, [service.title]);
  const isNelfund = service.id === 'nelfund-loan';

  function updateField(name: string, value: string) {
    setFormData((current) => ({ ...current, [name]: value }));
    setSubmitted(false);
    setError('');
  }

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSubmitted(false);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!user) {
        setAuthMode('signin');
        setError('Please sign in before submitting a service request.');
        return;
      }

      const { data: catalog, error: catalogError } = await supabase
        .from('service_catalog')
        .select('id, application_url')
        .eq('service_key', service.id)
        .eq('active', true)
        .maybeSingle();

      if (catalogError) throw catalogError;
      if (!catalog) throw new Error('This service is temporarily unavailable. Please try again later.');

      const safeFormData = Object.fromEntries(
        Object.entries(formData).map(([key, value]) => [key, value.trim()]),
      );

      const { data: request, error: requestError } = await supabase
        .from('service_requests')
        .insert({
          user_id: user.id,
          service_id: catalog.id,
          status: 'submitted',
          form_data: {
            service_key: service.id,
            service_title: service.title,
            ...safeFormData,
          },
        })
        .select('id')
        .single();

      if (requestError) throw requestError;

      setRequestId(String(request.id));
      setSubmitted(true);
      setFormData({});
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'We could not submit your request. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell title={title}>
      <section className="course_area section-padding">
        <div className="container">
          <div className="row align-items-start">
            <div className="col-lg-7">
              <article className="blog-detail-card service-detail-page-card">
                <img src={service.image} className="img-fluid blog-detail-image" alt={service.title} />
                <div className="blog-detail-content">
                  <div className="blog_meta"><span>{service.shortTitle}</span><span>EduReach Service</span></div>
                  <h2>{service.title}</h2>
                  <p className="blog-detail-lead">{detail.overview}</p>

                  <h4>How It Works</h4>
                  <ol className="service-step-list">{detail.steps.map((step) => <li key={step}>{step}</li>)}</ol>

                  <h4>What You May Need</h4>
                  <ul className="why_list service-requirement-list">{detail.requirements.map((item) => <li key={item}><i className="fa fa-check" /> {item}</li>)}</ul>

                  <h4>Important Notes</h4>
                  <ul className="service-note-list">{detail.notes.map((note) => <li key={note}>{note}</li>)}</ul>

                  {isNelfund && (
                    <div className="service-official-link">
                      <strong>Official NELFUND portal</strong>
                      <p>Use the official portal for the final application step.</p>
                      <a href="https://nelf.gov.ng/" target="_blank" rel="noreferrer" className="btn_one">Open NELFUND</a>
                    </div>
                  )}
                </div>
              </article>
            </div>

            <div className="col-lg-5">
              <div className="contact_info service-request-card">
                <div className="section-title"><h3>Request Support</h3><p>Sign in, send the details and keep your request ID for follow-up.</p></div>
                <form className="contact-form" onSubmit={submitRequest}>
                  {detail.fields.map((field) => field.name === 'message' || field.name === 'reason' ? (
                    <div className="col-md-12" key={field.name}>
                      <label htmlFor={field.name}>{field.label}</label>
                      <textarea id={field.name} name={field.name} className="form-control" rows={5} placeholder={field.placeholder} value={formData[field.name] || ''} onChange={(event) => updateField(field.name, event.target.value)} required={field.required} />
                    </div>
                  ) : (
                    <div className="col-md-12" key={field.name}>
                      <label htmlFor={field.name}>{field.label}</label>
                      <input id={field.name} name={field.name} type={field.type || 'text'} className="form-control" placeholder={field.placeholder} value={formData[field.name] || ''} onChange={(event) => updateField(field.name, event.target.value)} min={field.type === 'number' ? 1 : undefined} required={field.required} />
                    </div>
                  ))}

                  {error && <div className="form-feedback form-feedback-error">{error}</div>}
                  {submitted && <div className="form-feedback form-feedback-success">Request submitted successfully. Your request ID is <strong>{requestId}</strong>.</div>}

                  <div className="col-md-12">
                    <button className="btn_one" type="submit" disabled={loading}>{loading ? 'Submitting…' : 'Submit Request'}</button>
                  </div>
                </form>
                <button type="button" className="service-signin-link" onClick={() => setAuthMode('signin')}>Sign in before submitting</button>
                <p className="service-security-note">Never submit passwords, OTPs, banking passwords, card PINs or other secret credentials here.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      {authMode && <AuthModal mode={authMode} onClose={() => setAuthMode(null)} />}
    </Shell>
  );
}
