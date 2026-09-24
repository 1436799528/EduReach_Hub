import { ArrowRight, CheckCircle2 } from 'lucide-react';
import HubLayout from '../src/components/HubLayout';

type ExamKey = 'jamb' | 'waec' | 'neco' | 'post-utme';

type ExamLink = { label: string; href: string };

const data: Record<ExamKey, { title: string; logo: string; description: string; links: ExamLink[] }> = {
  jamb: {
    title: 'JAMB',
    logo: '/icons/brands/jamb.png',
    description: 'JAMB UTME, CAPS, results, admission and examination preparation resources.',
    links: [
      { label: 'Start JAMB CBT Simulator', href: '/cbt/setup/jamb' },
      { label: 'JAMB Question Banks', href: '/cbt?mode=JAMB' },
      { label: 'JAMB Slip Printing', href: '/services/apply/jamb-slip' },
      { label: 'Screening Calculator', href: '/screening-calculator' },
      { label: 'Admission Letters', href: '/services/apply/admission-letters' },
      { label: 'JAMB & CAPS Updates', href: '/news?category=jamb' },
    ],
  },
  waec: {
    title: 'WAEC',
    logo: '/icons/brands/waec.webp',
    description: 'WAEC examination information, results, preparation and study resources.',
    links: [
      { label: 'Start WAEC CBT Practice', href: '/cbt/setup/waec' },
      { label: 'WAEC Question Banks', href: '/cbt?mode=WAEC' },
      { label: 'Result Checking', href: '/services/apply/results' },
      { label: 'Screening Calculator', href: '/screening-calculator' },
      { label: 'WAEC News', href: '/news?category=waec' },
    ],
  },
  neco: {
    title: 'NECO',
    logo: '/icons/brands/neco.webp',
    description: 'NECO examination information, results, preparation and study resources.',
    links: [
      { label: 'Start NECO CBT Practice', href: '/cbt/setup/neco' },
      { label: 'NECO Question Banks', href: '/cbt?mode=NECO' },
      { label: 'Result Checking', href: '/services/apply/results' },
      { label: 'Screening Calculator', href: '/screening-calculator' },
      { label: 'NECO Updates', href: '/news?category=neco' },
    ],
  },
  'post-utme': {
    title: 'Post-UTME',
    logo: '/icons/brands/jamb.png',
    description: 'University screening information, admission preparation and Post-UTME practice.',
    links: [
      { label: 'Start Post-UTME Screening Test', href: '/cbt/setup/post-utme' },
      { label: 'Post-UTME Question Banks', href: '/cbt?mode=POST-UTME' },
      { label: 'Screening Calculator', href: '/screening-calculator' },
      { label: 'JAMB Slip Printing', href: '/services/apply/jamb-slip' },
      { label: 'Admission Letters', href: '/services/apply/admission-letters' },
      { label: 'Admission Lists & News', href: '/news?category=admission' },
    ],
  },
};

export default function ExamHubPage({ exam }: { exam: ExamKey }) {
  const item = data[exam];
  return (
    <HubLayout>
      <main className="er-major-page">
        <div className="er-major-container">
          <div className="er-major-heading">
            <div className="er-major-logo"><img src={item.logo} alt={`${item.title} logo`} /></div>
            <div><h1>{item.title}</h1><p>{item.description}</p></div>
          </div>

          <section className="er-major-grid">
            {item.links.map((link) => (
              <a href={link.href} key={link.label} className="er-major-link">
                <CheckCircle2 size={15} />
                <span>{link.label}</span>
                <ArrowRight size={13} />
              </a>
            ))}
          </section>

          <section className="er-major-info">
            <h2>EduReach {item.title} Centre</h2>
            <p>Use this page as the central place for {item.title} information, preparation resources, updates and related student services.</p>
          </section>
        </div>
      </main>
    </HubLayout>
  );
}
