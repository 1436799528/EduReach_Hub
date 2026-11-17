import { BookOpen, ClipboardList, FileText, GraduationCap, Info, Layers, MapPin, School } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  availableSessions,
  benchmarksFor,
  currentSession,
  englishCompulsoryFor,
  formatBenchmark,
  isCurrentSession,
  isDepartmentalCutoff,
  orderedSubjects,
  requirementFor,
  screeningMethodFor,
  usesCbtScreening,
  UTME_SUBJECT_AUTHORITY,
} from '../../lib/institutions/admissionSelection';
import {
  ASSESSMENT_METHOD_LABELS,
  BENCHMARK_TYPE_LABELS,
  ENTRY_MODE_LABELS,
  OWNERSHIP_LABELS,
  type AdmissionBenchmark,
  type AdmissionRoute,
  type Campus,
  type InstitutionProfile,
  type InstitutionSection,
  type PortalGuide,
  type ProgrammeOffering,
  type ProgrammeRequirement,
  type SectionState,
} from '../../lib/institutions/types';
import { SectionNote, SessionBadge, SourceLink, TrustBadge } from './TrustBadge';

/**
 * The sections of an institution profile.
 *
 * Two rules shape this component:
 *
 *   * A section renders only when it has rows. No placeholder cards, no
 *     "no departments yet" prose standing in for a fact.
 *   * Sections that have no published data are not scattered through the page
 *     as empty panels; they are named once, at the bottom, with the reason
 *     (not imported, or not published by the institution).
 */

const SECTION_TITLES = {
  campuses: 'Campuses',
  academicUnits: 'Faculties and academic units',
  departments: 'Departments',
  programmeOfferings: 'Programmes offered',
  admission: 'Admission requirements',
  benchmarks: 'Admission benchmarks and cut-offs',
  portalGuides: 'Admission process and portal instructions',
  sources: 'Official sources and verification history',
} as const;

/** The states that deserve a panel even without rows: they say something true. */
function informative(state: SectionState): boolean {
  return state === 'awaiting_review' || state === 'unavailable';
}

function SectionHeading({
  icon,
  title,
  count,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
}) {
  return (
    <h2 className="er-profile-section-title">
      <span className="er-profile-section-icon" aria-hidden="true">{icon}</span>
      {title}
      {typeof count === 'number' && <span className="er-profile-section-count">{count}</span>}
    </h2>
  );
}

function Section({ id, children, title, icon, count }: { id: string; children: React.ReactNode; title: string; icon: React.ReactNode; count?: number }) {
  return (
    <section className="er-profile-section" id={id} aria-labelledby={`${id}-title`}>
      <div id={`${id}-title`}>
        <SectionHeading icon={icon} title={title} count={count} />
      </div>
      {children}
    </section>
  );
}

export default function InstitutionProfileView({ profile }: { profile: InstitutionProfile }) {
  const sessions = useMemo(
    () =>
      profile.sessions.length
        ? profile.sessions
        : availableSessions(
            profile.admissionRoutes.items,
            profile.programmeRequirements.items,
            profile.benchmarks.items,
          ),
    [profile],
  );
  const [session, setSession] = useState<string | null>(() => currentSession(sessions));
  const activeSession = session ?? currentSession(sessions);

  const routes = useMemo(
    () => (activeSession ? profile.admissionRoutes.items.filter((route) => route.session === activeSession) : profile.admissionRoutes.items),
    [profile.admissionRoutes.items, activeSession],
  );
  const requirements = useMemo(
    () =>
      activeSession
        ? profile.programmeRequirements.items.filter((requirement) => requirement.session === activeSession)
        : profile.programmeRequirements.items,
    [profile.programmeRequirements.items, activeSession],
  );
  const benchmarks = useMemo(
    () => benchmarksFor(
      {
        offerings: profile.programmeOfferings.items,
        routes: profile.admissionRoutes.items,
        requirements: profile.programmeRequirements.items,
        benchmarks: profile.benchmarks.items,
      },
      { programmeOfferingId: null, session: activeSession },
    ),
    [profile, activeSession],
  );
  const offerings = useMemo(
    () =>
      activeSession
        ? profile.programmeOfferings.items.filter(
            (offering) => offering.session === activeSession || offering.session === null,
          )
        : profile.programmeOfferings.items,
    [profile.programmeOfferings.items, activeSession],
  );
  const guides = useMemo(
    () =>
      activeSession
        ? profile.portalGuides.items.filter((guide) => guide.session === activeSession || guide.session === null)
        : profile.portalGuides.items,
    [profile.portalGuides.items, activeSession],
  );

  const pending = PENDING_SECTIONS.filter(({ key }) => {
    const section = profile[key] as InstitutionSection<unknown>;
    return section.items.length === 0 && !informative(section.state);
  });

  const showOverview = Boolean(
    profile.overview || profile.officialName || profile.yearEstablished || profile.city || profile.postalAddress,
  );

  return (
    <div className="er-profile">
      {sessions.length > 0 && (
        <div className="er-profile-session-bar">
          <label className="er-profile-session-label" htmlFor="institution-session">
            Admission session
          </label>
          <select
            id="institution-session"
            className="er-profile-session-select"
            value={activeSession ?? ''}
            onChange={(event) => setSession(event.target.value || null)}
          >
            {sessions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <SessionBadge session={activeSession} isCurrent={isCurrentSession(activeSession, sessions)} />
          <p className="er-profile-session-note">
            Admission requirements change every cycle. Everything below applies to the session selected here.
          </p>
        </div>
      )}

      {showOverview && (
        <Section id="overview" title="Overview" icon={<Info size={15} />}>
          <dl className="er-profile-facts">
            {profile.officialName && profile.officialName !== profile.name && (
              <Fact label="Official name" value={profile.officialName} />
            )}
            {profile.ownership && <Fact label="Ownership" value={OWNERSHIP_LABELS[profile.ownership]} />}
            {profile.yearEstablished && <Fact label="Year established" value={String(profile.yearEstablished)} />}
            {profile.city && <Fact label="City" value={profile.city} />}
            {profile.postalAddress && <Fact label="Address" value={profile.postalAddress} />}
          </dl>
          {profile.overview && <p className="er-profile-prose">{profile.overview}</p>}
          <SourceLink url={profile.websiteUrl} label="Institution website" verifiedAt={profile.profileVerifiedAt} />
        </Section>
      )}

      {profile.campuses.items.length > 0 && (
        <Section id="campuses" title={SECTION_TITLES.campuses} icon={<MapPin size={15} />} count={profile.campuses.items.length}>
          <ul className="er-profile-list">
            {profile.campuses.items.map((campus) => (
              <CampusRow key={campus.id} campus={campus} />
            ))}
          </ul>
        </Section>
      )}

      {profile.academicUnits.items.length > 0 && (
        <Section
          id="academic-units"
          title={SECTION_TITLES.academicUnits}
          icon={<Layers size={15} />}
          count={profile.academicUnits.items.length}
        >
          <ul className="er-profile-chips">
            {profile.academicUnits.items.map((unit) => (
              <li key={unit.id} className="er-profile-chip">
                <span className="er-profile-chip-type">{unit.type}</span>
                <strong>{unit.name}</strong>
                <TrustBadge status={unit.status} verifiedAt={unit.lastVerifiedAt} withLabel={false} />
              </li>
            ))}
          </ul>
          <p className="er-profile-note">
            Unit types follow the institution&rsquo;s own structure. A faculty, a college, a school, an institute and a
            centre are different things and are not merged into one list here.
          </p>
        </Section>
      )}

      {profile.departments.items.length > 0 && (
        <Section id="departments" title={SECTION_TITLES.departments} icon={<School size={15} />} count={profile.departments.items.length}>
          <ul className="er-profile-chips">
            {profile.departments.items.map((unit) => (
              <li key={unit.id} className="er-profile-chip">
                <strong>{unit.name}</strong>
                {unit.parentUnitId && (
                  <span className="er-profile-chip-type">
                    {profile.academicUnits.items.find((parent) => parent.id === unit.parentUnitId)?.name ?? 'Parent unit'}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {offerings.length > 0 && (
        <Section id="programmes" title={SECTION_TITLES.programmeOfferings} icon={<GraduationCap size={15} />} count={offerings.length}>
          <ul className="er-profile-list">
            {offerings.map((offering) => (
              <ProgrammeRow key={offering.id} offering={offering} session={activeSession} />
            ))}
          </ul>
          <p className="er-profile-note">
            A programme listed here is offered by this institution. Institutional recognition (for example an NUC
            listing) is not the same as programme accreditation, and EduReach shows accreditation only when the
            accreditor&rsquo;s decision has been published and verified.
          </p>
        </Section>
      )}

      {(routes.length > 0 || requirements.length > 0) && (
        <Section id="admission" title={SECTION_TITLES.admission} icon={<ClipboardList size={15} />}>
          {routes.length > 0 && (
            <ul className="er-profile-list">
              {routes.map((route) => (
                <AdmissionRouteRow key={route.id} route={route} />
              ))}
            </ul>
          )}
          {requirements.length > 0 && (
            <ul className="er-profile-list">
              {requirements.map((requirement) => (
                <RequirementRow
                  key={requirement.id}
                  requirement={requirement}
                  programmeName={
                    profile.programmeOfferings.items.find((offering) => offering.id === requirement.programmeOfferingId)?.name ?? null
                  }
                />
              ))}
            </ul>
          )}
        </Section>
      )}

      {UTMERequirements(requirements).length > 0 && (
        <Section id="subject-combinations" title="JAMB subject combinations" icon={<BookOpen size={15} />}>
          <p className="er-profile-note">
            UTME subject combinations come from {UTME_SUBJECT_AUTHORITY.label}. Where the official rule requires it,
            English is marked compulsory rather than added by EduReach.
          </p>
          <ul className="er-profile-list">
            {UTMERequirements(requirements).map((requirement) => (
              <li key={requirement.id} className="er-profile-row">
                <div className="er-profile-row-head">
                  <strong>
                    {profile.programmeOfferings.items.find((offering) => offering.id === requirement.programmeOfferingId)?.name ??
                      'Programme'}
                  </strong>
                  <SourceLink url={UTME_SUBJECT_AUTHORITY.url} label={UTME_SUBJECT_AUTHORITY.name} />
                </div>
                <ol className="er-subject-list">
                  {orderedSubjects(requirement).map((subject) => (
                    <li key={subject} className="er-subject-item">
                      {subject}
                      {englishCompulsoryFor(requirement) && isEnglish(subject) && (
                        <span className="er-subject-flag">Compulsory</span>
                      )}
                    </li>
                  ))}
                </ol>
                <SourceLink url={requirement.sourceUrl} label="Institution source" verifiedAt={requirement.lastVerifiedAt} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {benchmarks.length > 0 && (
        <Section id="benchmarks" title={SECTION_TITLES.benchmarks} icon={<ClipboardList size={15} />} count={benchmarks.length}>
          <ul className="er-profile-list">
            {benchmarks.map((benchmark) => (
              <BenchmarkRow key={benchmark.id} benchmark={benchmark} />
            ))}
          </ul>
          <p className="er-profile-note">
            Each value is shown with the scale the institution published it on, so a UTME score out of 400 is never
            read as an aggregate out of 100. A national minimum is a policy floor, not a departmental cut-off.
          </p>
          {routes.some((route) => route.assessmentMethods.length > 0) && (
            <p className="er-profile-note">
              Screening method:{' '}
              {routes
                .flatMap((route) => route.assessmentMethods)
                .filter((method, index, all) => all.indexOf(method) === index)
                .map((method) => ASSESSMENT_METHOD_LABELS[method])
                .join(', ')}
              {usesCbtScreening(routes, activeSession) ? ' — CBT screening is published for this session.' : ''}
            </p>
          )}
        </Section>
      )}

      {guides.length > 0 && (
        <Section id="portal-guides" title={SECTION_TITLES.portalGuides} icon={<FileText size={15} />} count={guides.length}>
          <ul className="er-profile-list">
            {guides.map((guide) => (
              <PortalGuideRow key={guide.id} guide={guide} />
            ))}
          </ul>
          <p className="er-profile-note">
            EduReach never asks for your portal password, PIN, card details or OTP, and never collects payment on an
            institution&rsquo;s behalf. Payments happen only on the institution&rsquo;s own portal.
          </p>
        </Section>
      )}

      {profile.sources.items.length > 0 && (
        <Section id="sources" title={SECTION_TITLES.sources} icon={<FileText size={15} />} count={profile.sources.items.length}>
          <ul className="er-profile-list">
            {profile.sources.items.map((source) => (
              <li key={source.id} className="er-profile-row">
                <div className="er-profile-row-head">
                  <strong>{source.fieldKey}</strong>
                  <TrustBadge status={source.status} verifiedAt={source.checkedAt} />
                </div>
                <SourceLink url={source.sourceUrl} label="Source" verifiedAt={source.checkedAt} />
                {source.applicableSession && <span className="er-profile-meta">Applies to {source.applicableSession}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {pending.length > 0 && (
        <section className="er-profile-pending" aria-labelledby="pending-title">
          <h2 id="pending-title" className="er-profile-section-title">
            <span className="er-profile-section-icon" aria-hidden="true"><ClipboardList size={15} /></span>
            Not published for this institution yet
          </h2>
          <p className="er-profile-note">
            These sections are part of the institution-intelligence dataset EduReach is verifying. They stay hidden
            until the facts in them are sourced and reviewed, so nothing here is filled with an estimate.
          </p>
          <ul className="er-profile-pending-list">
            {pending.map(({ key, label }) => (
              <li key={key}>
                <strong>{label}</strong>
                <SectionNote state={(profile[key] as InstitutionSection<unknown>).state} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

const PENDING_SECTIONS: Array<{ key: keyof InstitutionProfile; label: string }> = [
  { key: 'campuses', label: SECTION_TITLES.campuses },
  { key: 'academicUnits', label: SECTION_TITLES.academicUnits },
  { key: 'departments', label: SECTION_TITLES.departments },
  { key: 'programmeOfferings', label: SECTION_TITLES.programmeOfferings },
  { key: 'admissionRoutes', label: SECTION_TITLES.admission },
  { key: 'benchmarks', label: SECTION_TITLES.benchmarks },
  { key: 'portalGuides', label: SECTION_TITLES.portalGuides },
  { key: 'sources', label: SECTION_TITLES.sources },
];

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="er-profile-fact">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function isEnglish(subject: string): boolean {
  return /^use of english$|^english( language)?$/i.test(subject.trim());
}

function UTMERequirements(requirements: ProgrammeRequirement[]): ProgrammeRequirement[] {
  return requirements.filter((requirement) => requirement.entryMode === 'UTME' && requirement.utmeSubjects.length > 0);
}

function CampusRow({ campus }: { campus: Campus }) {
  return (
    <li className="er-profile-row">
      <div className="er-profile-row-head">
        <strong>{campus.name}</strong>
        <span className="er-profile-meta">{campus.type}</span>
        <TrustBadge status={campus.status} verifiedAt={campus.lastVerifiedAt} />
      </div>
      {[campus.address, campus.city, campus.state].filter(Boolean).length > 0 && (
        <span className="er-profile-meta">{[campus.address, campus.city, campus.state].filter(Boolean).join(', ')}</span>
      )}
      {campus.description && <p className="er-profile-prose">{campus.description}</p>}
      <SourceLink url={campus.sourceUrl} verifiedAt={campus.lastVerifiedAt} />
    </li>
  );
}

function ProgrammeRow({ offering, session }: { offering: ProgrammeOffering; session: string | null }) {
  return (
    <li className="er-profile-row">
      <div className="er-profile-row-head">
        <strong>{offering.name}</strong>
        {offering.degreeTitle && <span className="er-profile-meta">{offering.degreeTitle}</span>}
        <TrustBadge status={offering.status} verifiedAt={offering.lastVerifiedAt} />
      </div>
      <span className="er-profile-meta">
        {[
          offering.code,
          offering.awardLevel,
          offering.durationYears ? `${offering.durationYears} years` : null,
          offering.deliveryMode,
        ]
          .filter(Boolean)
          .join(' · ')}
      </span>
      {offering.accreditationStatus === 'unknown' && (
        <span className="er-profile-meta">Accreditation: not published by EduReach</span>
      )}
      {offering.session && offering.session !== session && (
        <SessionBadge session={offering.session} isCurrent={false} />
      )}
      <SourceLink url={offering.sourceUrl} verifiedAt={offering.lastVerifiedAt} />
    </li>
  );
}

function AdmissionRouteRow({ route }: { route: AdmissionRoute }) {
  return (
    <li className="er-profile-row">
      <div className="er-profile-row-head">
        <strong>{ENTRY_MODE_LABELS[route.entryMode] ?? route.entryMode}</strong>
        <SessionBadge session={route.session} isCurrent />
        <TrustBadge status={route.status} verifiedAt={route.lastVerifiedAt} />
      </div>
      {route.assessmentMethods.length > 0 && (
        <span className="er-profile-meta">
          Screening: {route.assessmentMethods.map((method) => ASSESSMENT_METHOD_LABELS[method]).join(', ')}
        </span>
      )}
      <span className="er-profile-meta">
        {[
          route.firstChoiceRequired === true ? 'First choice required' : route.firstChoiceRequired === false ? 'First choice not required' : null,
          route.changeOfInstitutionAllowed === true ? 'Change of institution allowed' : null,
          route.opensOn ? `Opens ${route.opensOn}` : null,
          route.closesOn ? `Closes ${route.closesOn}` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </span>
      {route.eligibilityNotes && <p className="er-profile-prose">{route.eligibilityNotes}</p>}
      <SourceLink url={route.applicationUrl} label="Application portal" />
      <SourceLink url={route.sourceUrl} verifiedAt={route.lastVerifiedAt} />
    </li>
  );
}

function RequirementRow({ requirement, programmeName }: { requirement: ProgrammeRequirement; programmeName: string | null }) {
  const oLevel = describeRequirements(requirement.oLevelRequirements);
  const other = describeRequirements(requirement.otherRequirements);
  return (
    <li className="er-profile-row">
      <div className="er-profile-row-head">
        <strong>{programmeName ?? 'Programme'}</strong>
        <span className="er-profile-meta">{ENTRY_MODE_LABELS[requirement.entryMode] ?? requirement.entryMode}</span>
        <TrustBadge status={requirement.status} verifiedAt={requirement.lastVerifiedAt} />
      </div>
      {requirement.minimumUtmeScore !== null && (
        <span className="er-profile-meta">
          Minimum UTME score: {requirement.minimumUtmeScore} / {requirement.minimumUtmeScale}
        </span>
      )}
      {oLevel.length > 0 && (
        <ul className="er-profile-bullets">
          {oLevel.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      {other.length > 0 && (
        <ul className="er-profile-bullets">
          {other.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      {requirement.notes && <p className="er-profile-prose">{requirement.notes}</p>}
      <SourceLink url={requirement.sourceUrl} verifiedAt={requirement.lastVerifiedAt} />
    </li>
  );
}

/**
 * Render a requirement object as sentences.
 *
 * The column is JSONB, so the frontend describes what is there instead of
 * assuming a shape: a nested object becomes `key: value`, an array becomes a
 * list. Nothing is added to the values.
 */
function describeRequirements(value: Record<string, unknown>): string[] {
  const lines: string[] = [];
  for (const [key, entry] of Object.entries(value ?? {})) {
    const label = key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
    if (Array.isArray(entry)) {
      lines.push(`${label}: ${entry.map((item) => String(item)).join(', ')}`);
    } else if (entry && typeof entry === 'object') {
      for (const [innerKey, innerValue] of Object.entries(entry as Record<string, unknown>)) {
        lines.push(`${label} — ${innerKey}: ${String(innerValue)}`);
      }
    } else if (entry !== null && entry !== undefined && entry !== '') {
      lines.push(`${label}: ${String(entry)}`);
    }
  }
  return lines;
}

function BenchmarkRow({ benchmark }: { benchmark: AdmissionBenchmark }) {
  const method = screeningMethodFor(benchmark);
  return (
    <li className="er-profile-row">
      <div className="er-profile-row-head">
        <strong>{benchmark.label}</strong>
        <span className="er-profile-score">{formatBenchmark(benchmark)}</span>
        <TrustBadge status={benchmark.status} verifiedAt={benchmark.lastVerifiedAt} />
      </div>
      <span className="er-profile-meta">
        {BENCHMARK_TYPE_LABELS[benchmark.type]} · {isDepartmentalCutoff(benchmark) ? 'competitive cut-off' : benchmark.isEligibilityFloor ? 'eligibility floor' : 'published threshold'}
        {benchmark.stateCategory ? ` · ${benchmark.stateCategory}` : ''}
        {benchmark.categoryKey && benchmark.categoryKey !== 'general' ? ` · ${benchmark.categoryKey}` : ''}
      </span>
      {/* A screening formula is shown only when the institution published one.
          There is no default weighting and no estimate. */}
      {method && <p className="er-profile-prose">Published method: {method}</p>}
      {benchmark.notes && <p className="er-profile-prose">{benchmark.notes}</p>}
      <SourceLink url={benchmark.sourceUrl} verifiedAt={benchmark.lastVerifiedAt} />
    </li>
  );
}

function PortalGuideRow({ guide }: { guide: PortalGuide }) {
  return (
    <li className="er-profile-row">
      <div className="er-profile-row-head">
        <strong>{guide.title}</strong>
        <TrustBadge status={guide.status} verifiedAt={guide.lastVerifiedAt} />
      </div>
      {guide.summary && <p className="er-profile-prose">{guide.summary}</p>}
      {guide.safetyNote && <p className="er-profile-warning">{guide.safetyNote}</p>}
      <ol className="er-profile-steps">
        {guide.steps.map((step) => (
          <li key={`${guide.id}-${step.stepNumber}`}>
            <strong>{step.title}</strong>
            <p className="er-profile-prose">{step.instruction}</p>
            {step.documents.length > 0 && <span className="er-profile-meta">Bring: {step.documents.join(', ')}</span>}
            {step.warning && <p className="er-profile-warning">{step.warning}</p>}
            <SourceLink url={step.officialUrl} label="Official page" />
          </li>
        ))}
      </ol>
      <SourceLink url={guide.portalUrl} label="Portal" />
      <SourceLink url={guide.sourceUrl} verifiedAt={guide.lastVerifiedAt} />
    </li>
  );
}

/** Re-exported for the page-level error banner. */
export { requirementFor };
