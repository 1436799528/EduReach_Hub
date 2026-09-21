import { ArrowLeft, ArrowRight, BellRing, LayoutGrid, Newspaper, Timer } from 'lucide-react';
import HubLayout from '../src/components/HubLayout';
import { getServiceDefinition } from '../src/data/services';

type ComingSoonCopy = { eyebrow: string; title: string; description: string };

const copyByPath: Array<{ match: (path: string) => boolean; copy: ComingSoonCopy }> = [
  {
    match: (path) => path === '/nabteb',
    copy: {
      eyebrow: 'Examination centre',
      title: 'NABTEB centre is on the way',
      description:
        'The NABTEB information and preparation centre has not launched yet. Meanwhile, CBT practice and the verified noticeboard are fully available.',
    },
  },
  {
    match: (path) => path === '/schools' || path.startsWith('/admission/'),
    copy: {
      eyebrow: 'Admission',
      title: 'This admission section is on the way',
      description:
        'This admission guide has not launched yet. Meanwhile, you can estimate your aggregate with the screening calculator or follow verified admission updates.',
    },
  },
  {
    match: (path) => path === '/admission',
    copy: {
      eyebrow: 'Admission',
      title: 'Admission centre is on the way',
      description:
        'A dedicated admission centre with school guides, requirements and screening information is being prepared. Meanwhile, the screening calculator and noticeboard are fully available.',
    },
  },
  {
    match: (path) => path === '/tools' || path.startsWith('/tools/'),
    copy: {
      eyebrow: 'Student tools',
      title: 'This student tool is on the way',
      description:
        'This calculator or planner has not launched yet. Meanwhile, the screening aggregate calculator is fully available.',
    },
  },
  {
    match: (path) => path === '/support',
    copy: {
      eyebrow: 'Support',
      title: 'Student support centre is on the way',
      description:
        'A dedicated support centre is being prepared. Meanwhile, track any submitted request below or reach the official EduReach helpline.',
    },
  },
];

const fallbackCopy: ComingSoonCopy = {
  eyebrow: 'Student service',
  title: 'This service is not live yet',
  description:
    'This service has not launched yet. Browse the active services catalogue or track an existing request below.',
};

function copyFor(path: string): ComingSoonCopy {
  const definition = path.startsWith('/services/')
    ? getServiceDefinition(path.slice('/services/'.length).replace(/^apply\//, ''))
    : undefined;
  if (definition) {
    return {
      eyebrow: definition.category,
      title: `${definition.title} is not live yet`,
      description: `${definition.description} This service has not launched yet — browse the active services catalogue or track an existing request below.`,
    };
  }
  return copyByPath.find((entry) => entry.match(path))?.copy || fallbackCopy;
}

export default function ComingSoonPage({ title, description }: { title?: string; description?: string }) {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  const copy = copyFor(path);
  const heading = title || copy.title;
  const body = description || copy.description;
  const isServicePath = path.startsWith('/services/');
  const backHref = isServicePath ? '/services' : '/';
  const backLabel = isServicePath ? 'Services' : 'Portal home';

  return (
    <HubLayout>
      <div className="hub-page" style={{ padding: '32px 0 64px' }}>
        <div className="hub-container hub-narrow" style={{ maxWidth: '640px' }}>
          <a className="hub-back-link" href={backHref}>
            <ArrowLeft size={16} /> {backLabel}
          </a>

          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '32px 28px',
              textAlign: 'center',
              boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                fontWeight: 900,
                color: '#C85841',
                background: '#F9F0EE',
                border: '1px solid #F0D2BC',
                padding: '4px 12px',
                borderRadius: '999px',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              <BellRing size={13} /> {copy.eyebrow} · Coming soon
            </span>
            <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', margin: '14px 0 8px' }}>
              {heading}
            </h1>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 auto 22px', lineHeight: 1.6, maxWidth: '460px' }}>
              {body}
            </p>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <a
                href="/services"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#C85841',
                  color: '#ffffff',
                  borderRadius: '8px',
                  padding: '9px 18px',
                  fontSize: '12.5px',
                  fontWeight: 800,
                  textDecoration: 'none',
                }}
              >
                <LayoutGrid size={15} /> Active services
              </a>
              <a
                href="/services/track"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#ffffff',
                  color: '#0f172a',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '9px 18px',
                  fontSize: '12.5px',
                  fontWeight: 800,
                  textDecoration: 'none',
                }}
              >
                <Timer size={15} /> Track a request
              </a>
              <a
                href="/news"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#ffffff',
                  color: '#0f172a',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '9px 18px',
                  fontSize: '12.5px',
                  fontWeight: 800,
                  textDecoration: 'none',
                }}
              >
                <Newspaper size={15} /> Noticeboard <ArrowRight size={13} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </HubLayout>
  );
}
