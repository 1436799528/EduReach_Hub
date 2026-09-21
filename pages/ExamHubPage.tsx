import { ArrowRight, CheckCircle2 } from 'lucide-react';
import HubLayout from '../src/components/HubLayout';

type ExamKey = 'jamb' | 'waec' | 'neco' | 'post-utme';

type ExamLink = { label: string; href: string };

const data: Record<ExamKey, { title: string; logo: string; description: string; links: ExamLink[] }> = {
  jamb: {
    title: 'JAMB',
    logo: '/icons/brands/jamb.svg',
    description: 'JAMB UTME, CAPS, results, admission and examination preparation resources.',
    links: [
      { label: 'JAMB CBT Practice', href: '/cbt?mode=JAMB' },
      { label: 'Past Questions', href: '/past-questions' },
      { label: 'JAMB Slip Printing', href: '/services/apply/jamb-slip' },
      { label: 'CAPS & Admission Status', href: '/admission' },
      { label: 'Screening Calculator', href: '/screening-calculator' },
      { label: 'Latest Updates', href: '/news' },
    ],
  },
  waec: {
    title: 'WAEC',
    logo: '/icons/brands/waec.svg',
    description: 'WAEC examination information, results, preparation and study resources.',
    links: [
      { label: 'WAEC CBT Practice', href: '/cbt?mode=WAEC' },
      { label: 'Past Questions', href: '/past-questions' },
      { label: 'Result Checking', href: '/services/apply/results' },
      { label: 'Scratch Cards', href: '/services/apply/scratch-cards' },
      { label: 'Screening Calculator', href: '/screening-calculator' },
      { label: 'Latest Updates', href: '/news' },
    ],
  },
  neco: {
    title: 'NECO',
    logo: '/icons/brands/neco.svg',
    description: 'NECO examination information, results, preparation and study resources.',
    links: [
      { label: 'NECO CBT Practice', href: '/cbt?mode=NECO' },
      { label: 'Past Questions', href: '/past-questions' },
      { label: 'Result Checking', href: '/services/apply/results' },
      { label: 'Scratch Cards', href: '/services/apply/scratch-cards' },
      { label: 'Exam Timetable', href: '/tools/calendar' },
      { label: 'Latest Updates', href: '/news' },
    ],
  },
  'post-utme': {
    title: 'Post-UTME',
    logo: '/icons/post-utme.svg',
    description: 'University screening information, admission preparation and Post-UTME practice.',
    links: [
      { label: 'CBT Practice', href: '/cbt?mode=POST-UTME' },
      { label: 'Find a School', href: '/admission/schools' },
      { label: 'Screening Information', href: '/admission' },
      { label: 'Past Questions', href: '/past-questions' },
      { label: 'Admission Requirements', href: '/admission/requirements' },
      { label: 'Latest Updates', href: '/news' },
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
            <div className="er-major-logo"><img src={item.logo} alt="" /></div>
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
