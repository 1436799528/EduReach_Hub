import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, GraduationCap, Lock, ShieldCheck } from 'lucide-react';
import HubLayout from '../src/components/HubLayout';
import VerifiedBadge from '../src/components/VerifiedBadge';
import { SkeletonRows } from '../src/components/Skeleton';
import { fetchPublicProfile } from '../src/lib/publicProfileClient';
import type { PublicProfile } from '../src/lib/publicProfile';
import { navigateInApp } from '../src/lib/navigation';

/**
 * UI-5 — the visitor-facing public profile.
 *
 * This is a designed public route, not the private /profile page made readable
 * by accident. It renders only the whitelist the API returns, says plainly what
 * is not included, and gives a visitor a way back into EduReach without
 * pretending to be the owner's account.
 */

type View =
  | { status: 'loading' }
  | { status: 'ready'; profile: PublicProfile }
  | { status: 'missing' }
  | { status: 'error' };

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'ER';
}

export default function PublicProfilePage({ slug }: { slug: string }) {
  const [view, setView] = useState<View>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(() => {
    let active = true;
    setView({ status: 'loading' });
    fetchPublicProfile(slug)
      .then((profile) => { if (active) setView({ status: 'ready', profile }); })
      .catch((error: unknown) => {
        if (!active) return;
        setView({ status: error instanceof Error && error.message === 'not-found' ? 'missing' : 'error' });
      });
    return () => { active = false; };
  }, [slug]);

  useEffect(() => load(), [load, attempt]);

  useEffect(() => {
    document.title = view.status === 'ready'
      ? `${view.profile.full_name} · EduReach student profile`
      : 'Student profile · EduReach';
  }, [view]);

  const profile = view.status === 'ready' ? view.profile : null;

  return (
    <HubLayout>
      <div className="hub-page profile-page">
        <div className="hub-container profile-shell">
          {view.status === 'loading' && (
            <>
              <h1 className="er-visually-hidden">Student profile</h1>
              <div className="profile-identity-card" aria-busy="true">
                <div className="profile-identity-main">
                  <div className="profile-avatar" style={{ background: '#e2e8f0' }} aria-hidden="true" />
                  <div className="profile-identity-copy" style={{ minWidth: 220 }}>
                    <div className="er-skel er-skel-line" style={{ width: 160, height: 22 }} />
                    <div className="er-skel er-skel-line" style={{ width: 220, marginTop: 8 }} />
                  </div>
                </div>
              </div>
              <SkeletonRows rows={3} label="Loading public profile" />
            </>
          )}

          {view.status === 'missing' && (
            <section className="profile-panel" aria-labelledby="public-missing">
              <div className="profile-panel-heading"><Lock size={17} aria-hidden="true" /><h1 id="public-missing">Profile link unavailable</h1></div>
              <p className="profile-muted" style={{ marginBottom: 14 }}>
                This public profile link is not available. It may have been turned off, or it may never have existed.
                Profile links only work while the student keeps their public profile enabled.
              </p>
              <a className="hub-primary-btn" href="/">Go to EduReach <ArrowRight size={14} /></a>
            </section>
          )}

          {view.status === 'error' && (
            <section className="profile-panel" role="alert" aria-labelledby="public-error">
              <div className="profile-panel-heading"><ShieldCheck size={17} aria-hidden="true" /><h1 id="public-error">Profile could not be loaded</h1></div>
              <p className="profile-muted" style={{ marginBottom: 14 }}>
                EduReach could not load this profile right now. The link may still work in a moment.
              </p>
              <button type="button" className="hub-outline-btn" onClick={() => setAttempt((value) => value + 1)}>Try again</button>
            </section>
          )}

          {profile && (
            <>
              <header className="profile-identity-card">
                <div className="profile-identity-main">
                  <div className="profile-avatar" style={{ background: '#174A3A' }}>
                    {profile.avatar_url
                      ? <img src={profile.avatar_url} alt="" loading="lazy" decoding="async" />
                      : initials(profile.full_name)}
                  </div>
                  <div className="profile-identity-copy">
                    <div className="profile-identity-name">
                      <h1>{profile.full_name}</h1>
                      {profile.email_verified && <VerifiedBadge label="Verified EduReach account" />}
                    </div>
                    <p className="profile-identity-role">
                      Student{profile.level ? ` · ${profile.level} level` : ''}{profile.school ? ` · ${profile.school}` : ''}
                    </p>
                    {profile.course_programme && (
                      <p className="profile-identity-programme">{profile.course_programme}</p>
                    )}
                  </div>
                </div>
              </header>

              <div className="profile-panel-grid">
                <section className="profile-panel" aria-labelledby="public-academic">
                  <div className="profile-panel-heading">
                    <GraduationCap size={17} aria-hidden="true" />
                    <h2 id="public-academic">Academic information</h2>
                  </div>
                  <dl className="profile-facts">
                    {[
                      ['Institution', profile.school],
                      ['Programme', profile.course_programme],
                      ['Level', profile.level],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd className={value ? undefined : 'is-empty'}>{value || 'Not shared'}</dd>
                      </div>
                    ))}
                  </dl>
                </section>

                <section className="profile-panel" aria-labelledby="public-privacy">
                  <div className="profile-panel-heading">
                    <Lock size={17} aria-hidden="true" />
                    <h2 id="public-privacy">What this page does not show</h2>
                  </div>
                  <p className="profile-muted">
                    This student chose to share only their academic identity. Their email address, phone number,
                    matric number, examination history and notifications stay private.
                  </p>
                  <p className="profile-muted" style={{ marginTop: 10 }}>
                    Are you {profile.full_name.split(/\s+/)[0]}? Sign in to manage your own profile and public link.
                  </p>
                  <div className="profile-panel-actions">
                    <button type="button" className="hub-outline-btn" onClick={() => navigateInApp('/login')}>Sign in</button>
                  </div>
                </section>
              </div>

              <section className="profile-public-invite">
                <div>
                  <h2>Your own EduReach profile</h2>
                  <p>Keep your academic details, practice results and service requests in one place.</p>
                </div>
                <a className="hub-primary-btn" href="/register">Create an account <ArrowRight size={14} /></a>
              </section>

              <p className="profile-summary-note">
                Profile links are opt-in. A student can turn theirs off at any time, and this page will stop loading.
              </p>
            </>
          )}
        </div>
      </div>
    </HubLayout>
  );
}
