import { ArrowLeft, ExternalLink, MapPin, School } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import { itemKey, type Institution } from '../src/components/dashboard/SchoolFinderCard';
import { commonInstitutions, institutionCourseContexts } from '../src/data/studentOptions';
import { isSupabaseConfigured, supabase } from '../src/lib/supabase';
import { applySeo, seoForInstitution } from '../src/lib/seoMeta';
import { trackEvent } from '../src/lib/api';
import { EDUREACH_WHATSAPP } from '../src/data/hubContent';

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

function findStarterInstitution(slug: string): Institution | null {
  const normalized = itemKey(slug);
  if (!normalized) return null;
  for (let index = 0; index < commonInstitutions.length; index += 1) {
    const raw = commonInstitutions[index];
    if (raw.startsWith('Other')) continue;
    const match = raw.match(/^(.*?)(?:\s+\(([^)]+)\))?$/);
    const schoolName = match?.[1] || raw;
    const acronym = match?.[2] || null;
    if (itemKey(schoolName) === normalized || (acronym && itemKey(acronym) === normalized)) {
      return {
        id: `starter-school-${index + 1}`,
        school_name: schoolName,
        acronym,
        state: null,
        institution_type: /polytechnic/i.test(schoolName) ? 'Polytechnic' : /college/i.test(schoolName) ? 'College' : 'University',
        website_url: null,
        course_context: institutionCourseContexts[acronym || ''] || null,
      };
    }
  }
  return null;
}

export default function SchoolDetailsPage({ slug }: { slug: string }) {
  const params = new URLSearchParams(window.location.search);
  const starterMatch = useMemo(() => findStarterInstitution(slug), [slug]);
  const [liveSchool, setLiveSchool] = useState<Institution | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    const normalized = itemKey(slug);
    void supabase
      .from('institutions')
      .select('id,school_name,acronym,state,institution_type,website_url')
      .limit(400)
      .then(({ data }) => {
        if (!active || !data) return;
        const found = (data as Institution[]).find(
          (row) => itemKey(row.school_name) === normalized || (row.acronym && itemKey(row.acronym) === normalized)
        );
        if (found) setLiveSchool(found);
      });
    return () => { active = false; };
  }, [slug]);

  const resolved = liveSchool || starterMatch;

  useEffect(() => {
    // AN-1: which institutions students look up. The id is the directory key;
    // the URL parameters a visitor can hand-craft are deliberately not sent.
    trackEvent('school_view', { metadata: { schoolId: slug } });
  }, [slug]);
  const name = params.get('name') || resolved?.school_name || slug.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  const acronym = params.get('acronym') || resolved?.acronym || '';
  const state = params.get('state') || resolved?.state || 'Nigeria';
  const type = params.get('type') || resolved?.institution_type || 'Institution';
  const courseContext = params.get('course') || resolved?.course_context || (acronym ? institutionCourseContexts[acronym] || '' : '');
  const websiteCandidate = params.get('website') || resolved?.website_url || '';
  const website = /^https?:\/\//i.test(websiteCandidate) ? websiteCandidate : '';

  useEffect(() => {
    // Institution metadata uses only sourced facts. Programme, fee and cut-off
    // data are not claimed here because EduReach has no verified dataset for
    // them (see docs/architecture/02-DATA-MODEL.md).
    applySeo(seoForInstitution({
      slug,
      school_name: name,
      acronym,
      state: resolved?.state || null,
      institution_type: resolved?.institution_type || null,
      website_url: website || null,
    }));
  }, [slug, name, acronym, resolved?.state, resolved?.institution_type, website]);

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
            <div className="school-details-actions">
              {website
                ? <a className="hub-primary-btn" href={website} target="_blank" rel="noopener noreferrer">Visit official website <ExternalLink size={14} /></a>
                : (
                  <div className="school-details-no-site">
                    <span className="school-details-unavailable">No official website recorded for this institution</span>
                    <p>
                      EduReach will not guess a URL — a wrong link is worse than none. Ask us for the verified address and we will
                      send it, or check the institution&rsquo;s name with JAMB&rsquo;s institution list before you search elsewhere.
                    </p>
                    <a
                      className="hub-primary-btn"
                      href={`https://wa.me/${EDUREACH_WHATSAPP}?text=${encodeURIComponent(`Hello EduReach, please send me the verified official website and contact details for ${name}.`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Request the verified link <ExternalLink size={14} />
                    </a>
                  </div>
                )}
              <button type="button" className="hub-outline-btn" onClick={() => navigateBack('/schools')}><ArrowLeft size={14} /> Back to search</button>
            </div>
          </section>
        </div>
      </div>
    </HubLayout>
  );
}
