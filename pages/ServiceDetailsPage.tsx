import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { services } from '../src/data/edulebMock';
import { serviceWorkflows, type ServiceField } from '../src/data/serviceWorkflows';
import { Shell } from '../src/components/EdulebShared';
import AuthModal from '../src/components/AuthModal';
import { createServiceRequest, getCurrentUser } from '../src/services/serviceRequests';
import './service-details.css';

export default function ServiceDetailsPage({ id }: { id: string }) {
  const service = services.find((item) => item.id === id);
  const workflow = service ? serviceWorkflows[service.id] : undefined;
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<{ id: string; status: string; createdAt: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | null>(null);
  const [userReady, setUserReady] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadUser() {
      try {
        const user = await getCurrentUser();
        if (!active) return;
        setUserReady(Boolean(user));
        setValues((current) => ({
          ...current,
          fullName: current.fullName || user?.user_metadata?.full_name || '',
          email: current.email || user?.email || '',
        }));
      } catch {
        if (active) setUserReady(false);
      }
    }
    void loadUser();
    return () => { active = false; };
  }, [id]);

  const title = useMemo(() => service?.title ?? 'Service Not Found', [service?.title]);

  if (!service || !workflow) {
    return (
      <Shell title="Service Not Found">
        <section className="section-padding">
          <div className="container text-center service-not-found">
            <div className="section-title"><h2>This service could not be found.</h2><p>The service link may be invalid or the service may have been removed.</p></div>
            <a href="/services" className="btn_one">Back To Services</a>
          </div>
        </section>
      </Shell>
    );
  }

  function updateValue(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
    setError('');
    setSubmitted(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    try {
      const user = await getCurrentUser();
      if (!user) {
        setUserReady(false);
        setAuthMode('signin');
        setError('Please sign in before submitting your service request.');
        return;
      }
      setUserReady(true);
      setLoading(true);
      const result = await createServiceRequest(service.id, values);
      setSubmitted({ id: result.id, status: result.status, createdAt: result.created_at });
      setValues((current) => ({ fullName: current.fullName || user.user_metadata?.full_name || '', email: current.email || user.email || '' }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'We could not submit your request. Please try again.');
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
                <div className="service-detail-image-wrap"><img src={service.image} className="img-fluid blog-detail-image" alt={service.title} loading="lazy" /></div>
                <div className="blog-detail-content">
                  <div className="blog_meta"><span>{service.shortTitle}</span><span>EduReach Service</span></div>
                  <h2>{service.title}</h2>
                  <p className="blog-detail-lead">{workflow.overview}</p>
                  <h4>How It Works</h4>
                  <ol className="service-step-list">{workflow.steps.map((step) => <li key={step}>{step}</li>)}</ol>
                  <h4>What You May Need</h4>
                  <ul className="why_list service-requirement-list">{workflow.requirements.map((item) => <li key={item}><i className="fa fa-check" /> {item}</li>)}</ul>
                  <h4>Important Notes</h4>
                  <ul className="service-note-list">{workflow.notes.map((note) => <li key={note}>{note}</li>)}</ul>
                </div>
              </article>
            </div>
            <div className="col-lg-5">
              <div className="contact_info service-request-card">
                <div className="section-title"><h3>Request Support</h3><p>Submit your request and track the reference generated for you.</p></div>
                {!userReady && <div className="service-auth-note">You can read the service guidance without signing in, but you must sign in before submitting a request.</div>}
                {error && <div className="service-form-message service-form-error" role="alert">{error}</div>}
                {submitted ? (
                  <div className="service-success" role="status">
                    <span className="ti-check-box" aria-hidden="true" />
                    <h4>Request Submitted</h4>
                    <p>Your {service.shortTitle} request has been recorded successfully.</p>
                    <div className="service-reference">Reference: <strong>ER-{submitted.id.slice(0, 8).toUpperCase()}</strong></div>
                    <p className="service-status-line">Status: <strong>{submitted.status}</strong></p>
                    <p className="service-created-line">Submitted {new Date(submitted.createdAt).toLocaleString()}</p>
                    <button type="button" className="btn_one" onClick={() => setSubmitted(null)}>Submit Another Request</button>
                  </div>
                ) : (
                  <form className="contact-form service-request-form" onSubmit={handleSubmit}>
                    {workflow.fields.map((field) => <ServiceFieldInput key={field.name} field={field} value={values[field.name] ?? ''} onChange={(value) => updateValue(field.name, value)} />)}
                    <div className="col-md-12"><button className="btn_one service-submit-button" type="submit" disabled={loading}>{loading ? 'Submitting Request...' : 'Submit Request'}</button></div>
                  </form>
                )}
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

function ServiceFieldInput({ field, value, onChange }: { field: ServiceField; value: string; onChange: (value: string) => void }) {
  const inputId = `service-${field.name}`;
  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => onChange(event.target.value);
  return (
    <div className="col-md-12 service-form-field">
      <label htmlFor={inputId}>{field.label}</label>
      {field.type === 'textarea' ? (
        <textarea id={inputId} name={field.name} className="form-control" value={value} required={field.required} placeholder={field.placeholder} rows={5} onChange={handleChange} />
      ) : field.type === 'select' ? (
        <select id={inputId} name={field.name} className="form-control" value={value} required={field.required} onChange={handleChange}>
          <option value="">Select an option</option>
          {field.options?.map((option) => <option value={option} key={option}>{option}</option>)}
        </select>
      ) : (
        <input id={inputId} name={field.name} type={field.type || 'text'} className="form-control" value={value} required={field.required} placeholder={field.placeholder} min={field.type === 'number' ? 1 : undefined} onChange={handleChange} />
      )}
    </div>
  );
}
