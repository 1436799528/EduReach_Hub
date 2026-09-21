import { ArrowLeft, Home, Search, BookOpen, Laptop } from 'lucide-react';
import HubLayout from '../src/components/HubLayout';

export default function NotFoundPage() {
  return (
    <HubLayout>
      <div className="hub-page" style={{ padding: '40px 0 80px' }}>
        <div className="hub-container hub-narrow" style={{ maxWidth: '600px', textAlign: 'center' }}>
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '36px 24px',
              boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)',
            }}
          >
            <span
              style={{
                fontSize: '12px',
                fontWeight: 900,
                color: '#059669',
                background: '#ecfdf5',
                padding: '4px 12px',
                borderRadius: '999px',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                display: 'inline-block',
                marginBottom: '12px',
              }}
            >
              404 ERROR
            </span>
            <h1 style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a', margin: '0 0 8px' }}>
              Page Not Found
            </h1>
            <p style={{ fontSize: '13.5px', color: '#64748b', margin: '0 0 24px', lineHeight: 1.5 }}>
              The page you are looking for does not exist, has been moved, or the link may have expired. Jump directly to verified portal areas below:
            </p>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '24px' }}>
              <a
                className="hub-primary-btn"
                href="/"
                style={{ textDecoration: 'none', background: '#B8492F', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Home size={15} /> Portal Home
              </a>
              <a
                className="hub-outline-btn"
                href="/cbt"
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Laptop size={15} /> CBT Classroom
              </a>
              <a
                className="hub-outline-btn"
                href="/services"
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <BookOpen size={15} /> Services Catalog
              </a>
            </div>

            <button
              type="button"
              onClick={() => window.history.back()}
              style={{
                background: 'none',
                border: 0,
                color: '#64748b',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <ArrowLeft size={14} /> Return to previous page
            </button>
          </div>
        </div>
      </div>
    </HubLayout>
  );
}
