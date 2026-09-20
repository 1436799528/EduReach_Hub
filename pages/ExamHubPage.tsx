import { ArrowRight, CheckCircle2 } from 'lucide-react';
import HubLayout from '../src/components/HubLayout';

type ExamKey = 'jamb' | 'waec' | 'neco' | 'post-utme';

const data: Record<ExamKey, {
  title: string;
  logo: string;
  description: string;
  links: string[];
}> = {
  jamb: {
    title: 'JAMB',
    logo: '/icons/brands/jamb.png',
    description: 'JAMB UTME, CAPS, results, admission and examination preparation resources.',
    links: ['JAMB CBT Practice', 'JAMB Result', 'JAMB CAPS & Admission Status', 'UTME Syllabus', 'JAMB Brochure', 'Past Questions'],
  },
  waec: {
    title: 'WAEC',
    logo: '/icons/brands/waec.png',
    description: 'WAEC examination information, results, preparation and study resources.',
    links: ['WAEC Result', 'WAEC CBT Practice', 'Timetable', 'Syllabus', 'Registration Information', 'Past Questions'],
  },
  neco: {
    title: 'NECO',
    logo: '/icons/brands/neco.png',
    description: 'NECO examination information, results, preparation and study resources.',
    links: ['NECO Result', 'NECO CBT Practice', 'Timetable', 'Syllabus', 'Registration Information', 'Past Questions'],
  },
  'post-utme': {
    title: 'Post-UTME',
    logo: '/icons/brands/jamb.png',
    description: 'University screening information, admission preparation and Post-UTME practice.',
    links: ['Find a School', 'Screening Information', 'Post-UTME Past Questions', 'CBT Practice', 'Admission Requirements', 'Latest Updates'],
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
              <a href={exam === 'jamb' && link === 'JAMB CBT Practice' ? '/cbt?mode=JAMB' : exam === 'waec' && link === 'WAEC CBT Practice' ? '/cbt?mode=WAEC' : exam === 'neco' && link === 'NECO CBT Practice' ? '/cbt?mode=NECO' : exam === 'post-utme' && link === 'CBT Practice' ? '/cbt?mode=POST-UTME' : exam === 'post-utme' && link === 'Find a School' ? '/admission' : '/services'} key={link} className="er-major-link">
                <CheckCircle2 size={15} />
                <span>{link}</span>
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
