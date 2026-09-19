import { ArrowLeft, Home } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <main className="hub-page">
      <div className="hub-container hub-narrow">
        <section className="hub-panel hub-empty" aria-labelledby="not-found-title">
          <span className="hub-eyebrow">404</span>
          <h1 id="not-found-title">Page not found</h1>
          <p>The EduReach page you requested does not exist or has moved.</p>
          <div className="hub-wizard-actions">
            <a className="hub-outline-btn" href="/" aria-label="Return to EduReach home">
              <Home size={16} /> Home
            </a>
            <button className="hub-primary-btn" type="button" onClick={() => window.history.back()}>
              <ArrowLeft size={16} /> Go back
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
