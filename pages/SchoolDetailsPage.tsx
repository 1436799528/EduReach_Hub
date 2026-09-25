import { ArrowLeft, ExternalLink, MapPin, School } from 'lucide-react';
import HubLayout from '../src/components/HubLayout';

function navigateBack(fallback: string) {
  const params = new URLSearchParams(window.location.search);
  const returnTo = params.get('return');
  if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')) {
    window.history.pushState({}, '', returnTo);
    window.dispatchEvent(new PopStateEvent('popstate'));
    return;
  }
  if (window.history.length > 1) window.history.back();
  else {
    window.history.pushState({}, '', fallback);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}

export default function SchoolDetailsPage({ slug }: { slug: string }) {
  const params = new URLSearchParams(window.location.search);
  const name = params.get('name') || slug.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  const acronym = params.get('acronym') || '';
  const state = params.get('state') || 'Nigeria';
  const type = params.get('type') || 'Institution';
  const courseContext = params.get('course') || '';
  const websiteCandidate = params.get('website') || '';
  const website = /^https?:\/\//i.test(websiteCandidate) ? websiteCandidate : '';

  return (
    <HubLayout>
      <div className="hub-page school-details-page">
        <div className="hub-container school-details-container">
          <button type="button" className="hub-text-btn school-back-button" onClick={() => navigateBack('/schools')}><ArrowLeft size={16} /> Back to School Finder</button>
          <section className="school-details-card">
            <div className="school-details-icon"><School size={28} /></div>
            <span className="hub-eyebrow">Institution information</span>
            <h1>{name}</h1>
            <p className="school-details-meta">{acronym && <b>{acronym} · </b>}{type} <span>·</span> <MapPin size={14} /> {state}</p>
            <div className="school-details-copy"><h2>What we know</h2><p>This school is in the maintained EduReach institution directory. Programme, fees, admission cut-off and current screening details are not shown unless they have been verified and configured for this institution.</p>{courseContext && <p className="school-details-course-context"><strong>Configured course search tags:</strong> {courseContext.split(' ').slice(0, 12).join(', ')}{courseContext.split(' ').length > 12 ? '…' : ''}. Verify the current programme list with the school.</p>}</div>
            <div className="school-details-actions">{website ? <a className="hub-primary-btn" href={website} target="_blank" rel="noopener noreferrer">Visit official website <ExternalLink size={14} /></a> : <span className="school-details-unavailable">Official website link not configured</span>}<button type="button" className="hub-outline-btn" onClick={() => navigateBack('/schools')}><ArrowLeft size={14} /> Back to search</button></div>
          </section>
        </div>
      </div>
    </HubLayout>
  );
}
