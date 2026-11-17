import { ArrowLeft, ExternalLink, MapPin, School } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import { itemKey, type Institution } from '../src/components/dashboard/SchoolFinderCard';
import { TrustBadge } from '../src/components/institutions/TrustBadge';
import InstitutionProfileView from '../src/components/institutions/InstitutionProfileView';
import { commonInstitutions, institutionCourseContexts } from '../src/data/studentOptions';
import { identityNoteFor, mapProfileFromDirectory } from '../src/lib/institutions/mappers';
import { canonicalInstitutionId } from '../src/lib/institutions/aliases';
import { fetchInstitutionDirectory, fetchInstitutionProfile } from '../src/lib/institutions/repository';
import { resolveInstitution } from '../src/lib/institutions/selectors';
import { isInstitutionId, normalizeCategory } from '../src/lib/institutions/normalizers';
import { OWNERSHIP_LABELS, type InstitutionProfile, type InstitutionSummary } from '../src/lib/institutions/types';
import { isSupabaseConfigured } from '../src/lib/supabase';
import { applySeo, seoForInstitution } from '../src/lib/seoMeta';
import { trackEvent } from '../src/lib/api';
import { EDUREACH_WHATSAPP } from '../src/data/hubContent';
import PublicPdfList from '../src/components/PublicPdfList';
import { navigateInApp } from '../src/lib/navigation';

function navigateBack(fallback: string) {
  const params = new URLSearchParams(window.location.search);
  const returnTo = params.get('return');
  if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')) {
    navigateInApp(returnTo);
    return;
  }
  if (window.history.length > 1) window.history.back();
  else {
    navigateInApp(fallback);
  }
}

/**
 * Starter identity for the unconfigured local preview only.
 *
 * Production resolves institutions from the live directory. This list exists so
 * `/schools/<name>` still renders something meaningful in a preview with no
 * Supabase credentials.
 */
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
  // Read once per slug: the page is keyed by the route segment, and a fresh
  // object on every render would re-run the directory lookup forever.
  const params = useMemo(() => new URLSearchParams(window.location.search), [slug]);
  const starterMatch = useMemo(() => findStarterInstitution(slug), [slug]);

  const [profile, setProfile] = useState<InstitutionProfile | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  // The identity the page will present. Resolved by canonical id first, then
  // by slug or name, so an old link and a new link reach the same institution.
  const [resolved, setResolved] = useState<InstitutionSummary | null>(null);

  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured) return;
    setLoading(true);
    void fetchInstitutionDirectory()
      .then((rows) => {
        if (!active) return;
        const requestedId = params.get('id');
        const canonical = requestedId && isInstitutionId(requestedId) ? canonicalInstitutionId(requestedId) : null;
        const byId = canonical ? rows.find((row) => row.id.toLowerCase() === canonical.toLowerCase()) ?? null : null;
        setResolved(byId ?? resolveInstitution(rows, slug) ?? null);
        setError('');
      })
      .catch(() => {
        if (!active) return;
        setError('The institution directory could not be loaded right now.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug, params, attempt]);

  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured || !resolved) return;
    void fetchInstitutionProfile(resolved.id)
      .then((value) => {
        if (active) setProfile(value);
      })
      .catch(() => {
        // A failed intelligence read must not lose the identity the student
        // came for; the page keeps the directory facts and says nothing more.
        if (active) setProfile(null);
      });
    return () => {
      active = false;
    };
  }, [resolved]);

  useEffect(() => {
    // AN-1: which institutions students look up. The canonical id is the
    // directory key; the URL parameters a visitor can hand-craft are not sent.
    trackEvent('school_view', { metadata: { schoolId: resolved?.id ?? slug } });
  }, [slug, resolved?.id]);

  // In the unconfigured preview there is no directory to read, so the starter
  // identity is mapped into the same model. The page then behaves identically:
  // an identity plus sections that are honest about being unpublished.
  const starterSummary = useMemo<InstitutionSummary | null>(() => {
    if (isSupabaseConfigured || !starterMatch) return null;
    const match = starterMatch;
    return {
      id: match.id,
      name: match.school_name,
      acronym: match.acronym ?? null,
      state: match.state ?? null,
      institutionType: match.institution_type ?? null,
      category: normalizeCategory(match.institution_type),
      ownership: null,
      websiteUrl: match.website_url ?? null,
      admissionPortalUrl: null,
      studentPortalUrl: null,
      slug: itemKey(match.school_name),
      aliases: [],
      postUtme: null,
      verifiedWebsite: false,
      intelligencePublished: false,
    };
  }, [starterMatch]);

  const identity = resolved ?? starterSummary;
  const effectiveProfile = useMemo(
    () => profile ?? (identity ? mapProfileFromDirectory(identity) : null),
    [profile, identity],
  );

  const fallbackName = slug.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  const name = identity?.name || params.get('name') || starterMatch?.school_name || fallbackName;
  const acronym = identity?.acronym || params.get('acronym') || starterMatch?.acronym || '';
  const state = identity?.state || params.get('state') || 'Nigeria';
  const type = identity?.institutionType || params.get('type') || starterMatch?.institution_type || 'Institution';
  const ownership = identity?.ownership ?? null;
  const courseContext =
    params.get('course') || starterMatch?.course_context || (acronym ? institutionCourseContexts[acronym] || '' : '');
  const websiteCandidate = identity?.websiteUrl || params.get('website') || '';
  const website = /^https?:\/\//i.test(websiteCandidate) ? websiteCandidate : '';
  const canonicalId = identity && isInstitutionId(canonicalInstitutionId(identity.id)) ? canonicalInstitutionId(identity.id) : null;
  const aliasNote = identity ? identityNoteFor(identity.id) : null;

  useEffect(() => {
    applySeo(
      seoForInstitution({
        slug,
        school_name: name,
        acronym,
        state: resolved?.state || null,
        institution_type: resolved?.institutionType || null,
        website_url: website || null,
      }),
    );
  }, [slug, name, acronym, resolved?.state, resolved?.institutionType, website]);

  return (
    <HubLayout>
      <div className="hub-page school-details-page">
        <div className="hub-container school-details-container">
          <button type="button" className="hub-text-btn school-back-button" onClick={() => navigateBack('/schools')}>
            <ArrowLeft size={16} /> Back to School Finder
          </button>
          <section className="school-details-card">
            <div className="school-details-icon"><School size={28} /></div>
            <span className="hub-eyebrow">Institution information</span>
            <h1>{name}</h1>
            <p className="school-details-meta">
              {acronym && <b>{acronym} · </b>}
              {type} <span>·</span> <MapPin size={14} /> {state}
            </p>
            <div className="er-finder-badges" style={{ marginTop: 8 }}>
              {ownership && <span className="er-ownership-badge">{OWNERSHIP_LABELS[ownership]}</span>}
              {identity?.intelligencePublished ? (
                <TrustBadge status="verified" verifiedAt={profile?.profileVerifiedAt} />
              ) : (
                <TrustBadge status="unresearched" />
              )}
            </div>
            {aliasNote && <p className="er-section-note">{aliasNote}</p>}
            <div className="school-details-copy">
              <h2>What we know</h2>
              <p>
                This school is in the maintained EduReach institution directory. Programme, faculty, campus, fees,
                admission cut-off and current screening details are not shown unless they have been verified against
                the institution&rsquo;s own publication and configured here.
              </p>
              {courseContext && (
                <p className="school-details-course-context">
                  <strong>Configured course search tags:</strong>{' '}
                  {courseContext.split(' ').slice(0, 12).join(', ')}
                  {courseContext.split(' ').length > 12 ? '…' : ''}. Verify the current programme list with the school.
                </p>
              )}
            </div>
            <div className="school-details-actions">
              {website ? (
                <a className="hub-primary-btn" href={website} target="_blank" rel="noopener noreferrer">
                  Visit official website <ExternalLink size={14} />
                </a>
              ) : (
                <div className="school-details-no-site">
                  <span className="school-details-unavailable">No official website recorded for this institution</span>
                  <p>
                    EduReach will not guess a URL. A wrong link is worse than none. Ask us for the verified address and
                    we will send it, or check the institution&rsquo;s name with JAMB&rsquo;s institution list before you
                    search elsewhere.
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
              <button type="button" className="hub-outline-btn" onClick={() => navigateBack('/schools')}>
                <ArrowLeft size={14} /> Back to search
              </button>
            </div>
          </section>

          {error && (
            <div className="hub-form-error" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginTop: 16 }}>
              <span>{error}</span>
              <button type="button" className="hub-outline-btn" onClick={() => setAttempt((value) => value + 1)}>Try again</button>
            </div>
          )}

          {effectiveProfile && <InstitutionProfileView profile={effectiveProfile} />}

          {!effectiveProfile && !loading && (
            <p className="er-section-note" style={{ marginTop: 16 }}>
              This name is not in the EduReach institution directory yet. Search the finder for the full list of
              institutions we maintain.
            </p>
          )}

          <PublicPdfList destination="admission_guides" title="Admission guides for this school" institutionId={canonicalId} />
          <PublicPdfList destination="school_resources" title="School resources" institutionId={canonicalId} />
        </div>
      </div>
    </HubLayout>
  );
}
