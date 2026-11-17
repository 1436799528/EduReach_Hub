import { useMemo, useState } from 'react';
import OptimizedImage from '../OptimizedImage';
import { userFacingError } from '../../../lib/errors';
import {
  createInstitutionProgramme,
  createInstitutionUnit,
  isInstitutionGateError,
  reviewInstitutionEvidence,
  saveInstitutionProfileSection,
  updateInstitutionAdmissionRoute,
  updateInstitutionEvidence,
  updateInstitutionProgramme,
  updateInstitutionRequirement,
  updateInstitutionUnit,
  type InstitutionAdminDetail,
  type InstitutionAdminProfile,
  type InstitutionAdminProgramme,
  type InstitutionAdminRequirement,
  type InstitutionAdminRoute,
  type InstitutionAdminUnit,
  type InstitutionEvidenceRow,
  type InstitutionProfileSection,
  type InstitutionReviewCheck,
} from '../../lib/api';

/**
 * The institution editor.
 *
 * Ten sections, each with its own Save. A wrong programme code is fixed by saving
 * that one programme; nothing here rewrites the institution to change a field.
 * Only the fields an editor actually touched are sent, so an untouched column is
 * never blanked by a save on a neighbouring section.
 *
 * Two rules are visible rather than implied:
 *   * verification and publication are separate controls, and the publication
 *     gate says in words why "published" is refused while anything is unverified;
 *   * correcting a source replaces the link on record, it never deletes the
 *     evidence row or the note that explained it.
 */

const VERIFICATION_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'unresearched', label: 'Unresearched — nobody has looked yet' },
  { value: 'discovered', label: 'Discovered — found, not checked' },
  { value: 'in_review', label: 'In review — being checked' },
  { value: 'verified', label: 'Verified — a source states it' },
  { value: 'disputed', label: 'Disputed — sources disagree' },
  { value: 'outdated', label: 'Outdated — true for an earlier session' },
  { value: 'unpublished_by_institution', label: 'Withdrawn by the institution' },
];

const PUBLICATION_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'draft', label: 'Draft — internal only' },
  { value: 'in_review', label: 'In review — internal only' },
  { value: 'published', label: 'Published — visible to students' },
  { value: 'archived', label: 'Archived — kept, not shown' },
];

const UNIT_TYPES = ['faculty', 'college', 'school', 'institute', 'centre', 'department', 'division', 'other'];
const ENTRY_MODES = ['UTME', 'DIRECT_ENTRY', 'JUPEB', 'IJMB', 'PRE_DEGREE', 'DIPLOMA', 'ND', 'HND', 'TRANSFER', 'OTHER'];
const AWARD_LEVELS = ['BSc', 'BA', 'BEng', 'BTech', 'BEd', 'BNSc', 'LLB', 'ND', 'HND', 'PGD', 'MSc', 'MA', 'MBA', 'PhD', 'Other'];
const YES_NO: Array<{ value: string; label: string }> = [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }];

type FieldType = 'text' | 'textarea' | 'number' | 'url' | 'select' | 'date';

interface FieldSpec {
  key: string;
  label: string;
  type: FieldType;
  options?: Array<string | { value: string; label: string }>;
  hint?: string;
  placeholder?: string;
  full?: boolean;
}

type Values = Record<string, string>;

const IDENTITY_FIELDS: FieldSpec[] = [
  { key: 'school_name', label: 'Institution name (search)', type: 'text', hint: 'The name students see in the school finder.' },
  { key: 'official_name', label: 'Official name', type: 'text', hint: 'Exactly as the institution writes it.' },
  { key: 'acronym', label: 'Acronym', type: 'text' },
  { key: 'ownership', label: 'Ownership', type: 'select', options: ['federal', 'state', 'private', 'other', 'unknown'] },
  { key: 'institution_category', label: 'Category', type: 'select', options: ['university', 'polytechnic', 'monotechnic', 'college_of_education', 'college_of_agriculture', 'college_of_nursing', 'innovation_enterprise_institute', 'other'] },
  { key: 'year_established', label: 'Year established', type: 'number', placeholder: '1960' },
  { key: 'state', label: 'State', type: 'text' },
  { key: 'city', label: 'City / town', type: 'text' },
  { key: 'institution_type', label: 'Type (directory label)', type: 'text' },
  { key: 'postal_address', label: 'Postal address', type: 'textarea', full: true },
  { key: 'country', label: 'Country', type: 'text' },
];

const HISTORY_FIELDS: FieldSpec[] = [
  { key: 'history_summary', label: 'History', type: 'textarea', full: true, hint: 'Only what a source states. Do not paraphrase a founding date nobody recorded.' },
  { key: 'overview', label: 'Overview for students', type: 'textarea', full: true },
  { key: 'mission', label: 'Mission', type: 'textarea', full: true },
  { key: 'vision', label: 'Vision', type: 'textarea', full: true },
  { key: 'mandate', label: 'Mandate', type: 'textarea', full: true },
];

const PORTAL_FIELDS: FieldSpec[] = [
  { key: 'official_website_url', label: 'Official website', type: 'url', hint: 'The address on the institution’s own letterhead, not an aggregator.' },
  { key: 'admission_portal_url', label: 'Admission portal', type: 'url' },
  { key: 'student_portal_url', label: 'Student portal', type: 'url' },
  { key: 'postgraduate_portal_url', label: 'Postgraduate portal', type: 'url' },
  { key: 'website_url', label: 'Directory website', type: 'url', hint: 'Shown by the school finder. Keep it the same as the official website.' },
];

const IMAGE_FIELDS: FieldSpec[] = [
  { key: 'logo_url', label: 'Logo URL', type: 'url', hint: 'An address on the institution’s servers. EduReach does not claim ownership of it.' },
  { key: 'hero_image_url', label: 'Campus image URL', type: 'url', hint: 'A real photograph of this campus. Never a stock image of a different school.' },
];

const VERIFICATION_FIELDS: FieldSpec[] = [
  { key: 'verification_status', label: 'Verification', type: 'select', options: VERIFICATION_OPTIONS },
  { key: 'publication_status', label: 'Publication', type: 'select', options: PUBLICATION_OPTIONS },
  { key: 'source_url', label: 'Source for this profile', type: 'url', hint: 'The page that states the facts above.' },
  { key: 'review_note', label: 'Research note', type: 'textarea', full: true, hint: 'What is still missing, and who checked it last.' },
];

const UNIT_FIELDS: FieldSpec[] = [
  { key: 'unit_type', label: 'Type', type: 'select', options: UNIT_TYPES },
  { key: 'unit_name', label: 'Name', type: 'text' },
  { key: 'parent_unit_id', label: 'Parent unit', type: 'select', options: [] },
  { key: 'verification_status', label: 'Verification', type: 'select', options: VERIFICATION_OPTIONS },
  { key: 'source_url', label: 'Source URL', type: 'url' },
  { key: 'review_note', label: 'Review note', type: 'text' },
  { key: 'is_active', label: 'Active in the catalogue', type: 'select', options: YES_NO },
];

const PROGRAMME_FIELDS: FieldSpec[] = [
  { key: 'programme_name', label: 'Programme name', type: 'text' },
  { key: 'programme_code', label: 'Programme code', type: 'text' },
  { key: 'academic_unit_id', label: 'Academic unit', type: 'select', options: [] },
  { key: 'degree_title', label: 'Degree title', type: 'text' },
  { key: 'award_level', label: 'Award level', type: 'select', options: AWARD_LEVELS },
  { key: 'duration_years', label: 'Duration (years)', type: 'number' },
  { key: 'admission_session', label: 'Admission session', type: 'text', placeholder: '2026/2027' },
  { key: 'verification_status', label: 'Verification', type: 'select', options: VERIFICATION_OPTIONS },
  { key: 'publication_status', label: 'Publication', type: 'select', options: PUBLICATION_OPTIONS },
  { key: 'source_url', label: 'Source URL', type: 'url' },
  { key: 'review_note', label: 'Review note', type: 'text' },
  { key: 'is_active', label: 'Currently offered', type: 'select', options: YES_NO },
];

const ROUTE_FIELDS: FieldSpec[] = [
  { key: 'admission_session', label: 'Session', type: 'text', placeholder: '2026/2027' },
  { key: 'entry_mode', label: 'Entry mode', type: 'select', options: ENTRY_MODES },
  { key: 'opens_on', label: 'Opens on', type: 'date' },
  { key: 'closes_on', label: 'Closes on', type: 'date' },
  { key: 'application_url', label: 'Application URL', type: 'url' },
  { key: 'assessment_methods', label: 'Assessment methods (comma separated)', type: 'text' },
  { key: 'first_choice_required', label: 'First choice required', type: 'select', options: YES_NO },
  { key: 'change_of_institution_allowed', label: 'Change of institution allowed', type: 'select', options: YES_NO },
  { key: 'verification_status', label: 'Verification', type: 'select', options: VERIFICATION_OPTIONS },
  { key: 'publication_status', label: 'Publication', type: 'select', options: PUBLICATION_OPTIONS },
  { key: 'source_url', label: 'Source URL', type: 'url' },
  { key: 'eligibility_notes', label: 'Eligibility notes', type: 'textarea', full: true },
  { key: 'review_note', label: 'Review note', type: 'text' },
];

const REQUIREMENT_FIELDS: FieldSpec[] = [
  { key: 'admission_session', label: 'Session', type: 'text' },
  { key: 'entry_mode', label: 'Entry mode', type: 'select', options: ENTRY_MODES },
  { key: 'utme_subjects', label: 'UTME subject combination', type: 'text', placeholder: 'Use of English, Mathematics, Physics, Chemistry' },
  { key: 'minimum_utme_score', label: 'Minimum score', type: 'number' },
  { key: 'minimum_utme_scale', label: 'Scale', type: 'number' },
  { key: 'o_level_credits', label: 'O’Level credits', type: 'number' },
  { key: 'o_level_subjects', label: 'O’Level subjects', type: 'text' },
  { key: 'o_level_summary', label: 'O’Level note', type: 'text' },
  { key: 'a_level_credits', label: 'A’Level credits', type: 'number' },
  { key: 'a_level_subjects', label: 'A’Level subjects', type: 'text' },
  { key: 'a_level_summary', label: 'A’Level note', type: 'text' },
  { key: 'verification_status', label: 'Verification', type: 'select', options: VERIFICATION_OPTIONS },
  { key: 'publication_status', label: 'Publication', type: 'select', options: PUBLICATION_OPTIONS },
  { key: 'source_url', label: 'Source URL', type: 'url' },
  { key: 'notes', label: 'Notes', type: 'textarea', full: true },
  { key: 'review_note', label: 'Review note', type: 'text' },
];

/* -------------------------------------------------------------------------- */
/* Small presentational pieces                                                */
/* -------------------------------------------------------------------------- */

const CHECK_GLYPH: Record<InstitutionReviewCheck['state'], string> = {
  ok: '✓',
  review: '⚠ Review',
  missing: '⚠ Missing',
};

function CheckLine({ check }: { check: InstitutionReviewCheck }) {
  return (
    <li className={`admin-check admin-check-${check.state}`} data-state={check.state}>
      <span aria-hidden="true">{CHECK_GLYPH[check.state]}</span>{' '}
      <strong>{check.label}</strong> <span className="muted">{check.detail}</span>
    </li>
  );
}

function Section({
  number,
  title,
  description,
  children,
  actions,
}: {
  number: number;
  title: string;
  description: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="admin-card" style={{ padding: 18, marginBottom: 18 }} aria-labelledby={`institution-section-${number}`}>
      <div className="admin-card-header">
        <div>
          <h2 id={`institution-section-${number}`} style={{ margin: 0 }}>{number}. {title}</h2>
          <p className="muted" style={{ margin: '4px 0 0' }}>{description}</p>
        </div>
        {actions}
      </div>
      <div style={{ marginTop: 12 }}>{children}</div>
    </section>
  );
}

function Field({
  spec,
  value,
  onChange,
  disabled,
}: {
  spec: FieldSpec;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const id = `field-${spec.key}`;
  const control = spec.type === 'textarea'
    ? (
      <textarea
        id={id}
        className="admin-input"
        rows={3}
        aria-label={spec.label}
        value={value}
        disabled={disabled}
        placeholder={spec.placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    )
    : spec.type === 'select'
      ? (
        <select id={id} className="admin-select" aria-label={spec.label} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
          <option value="">Not recorded</option>
          {(spec.options ?? []).map((option) => {
            const entry = typeof option === 'string' ? { value: option, label: option.replace(/_/g, ' ') } : option;
            return <option key={entry.value} value={entry.value}>{entry.label}</option>;
          })}
        </select>
      )
      : (
        <input
          id={id}
          className="admin-input"
          aria-label={spec.label}
          type={spec.type === 'number' ? 'number' : spec.type === 'date' ? 'date' : 'text'}
          inputMode={spec.type === 'url' ? 'url' : spec.type === 'number' ? 'numeric' : undefined}
          value={value}
          disabled={disabled}
          placeholder={spec.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      );
  return (
    <label className="admin-field" style={spec.full ? { gridColumn: '1 / -1' } : undefined} htmlFor={id}>
      <span>{spec.label}</span>
      {control}
      {spec.hint && <small className="muted">{spec.hint}</small>}
    </label>
  );
}

function FieldGrid({ fields, values, onChange, disabled }: {
  fields: FieldSpec[];
  values: Values;
  onChange: (key: string, value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="admin-field-row" style={{ flexWrap: 'wrap', gap: 12 }}>
      {fields.map((spec) => (
        <Field key={spec.key} spec={spec} value={values[spec.key] ?? ''} disabled={disabled} onChange={(value) => onChange(spec.key, value)} />
      ))}
    </div>
  );
}

function Messages({ error, message }: { error: string; message?: string }) {
  if (error) return <div className="admin-card" role="alert" style={{ padding: '12px 16px', marginBottom: 12 }}>{error}</div>;
  if (message) return <div className="admin-card" role="status" style={{ padding: '12px 16px', marginBottom: 12, borderLeft: '4px solid var(--admin-green)' }}>{message}</div>;
  return null;
}

/* -------------------------------------------------------------------------- */
/* Field plumbing                                                             */
/* -------------------------------------------------------------------------- */

function textOf(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function initialValues(fields: FieldSpec[], source: Record<string, unknown>): Values {
  const state: Values = {};
  for (const field of fields) state[field.key] = textOf(source[field.key]);
  return state;
}

/** Send only what the editor changed, so an untouched column is never blanked. */
function changedValues(fields: FieldSpec[], current: Values, initial: Values): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of fields) {
    const raw = current[field.key] ?? '';
    if (raw === (initial[field.key] ?? '')) continue;
    if (field.type === 'number') values[field.key] = raw.trim() === '' ? null : Number(raw);
    else values[field.key] = raw.trim() === '' ? null : raw.trim();
  }
  return values;
}

function profileRecord(profile: InstitutionAdminProfile | null): Record<string, unknown> {
  if (!profile) return {};
  const record: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(profile)) record[key] = value;
  return record;
}

function saveError(error: unknown, fallback: string): string {
  if (isInstitutionGateError(error)) {
    return `${userFacingError(error, fallback)} Nothing was published: the public page keeps showing only verified rows.`;
  }
  return userFacingError(error, fallback);
}

function numberOrNull(raw: string): number | null {
  return raw.trim() === '' ? null : Number(raw);
}

function boolOrNull(raw: string): boolean | null {
  return raw === '' ? null : raw === 'true';
}

function commaList(raw: string): string[] {
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
}

/* -------------------------------------------------------------------------- */
/* 1–4, 10: profile sections                                                  */
/* -------------------------------------------------------------------------- */

function ProfileSectionForm({
  section,
  fields,
  detail,
  onSaved,
  saveLabel = 'Save section',
}: {
  section: InstitutionProfileSection;
  fields: FieldSpec[];
  detail: InstitutionAdminDetail;
  onSaved: (message: string) => void;
  saveLabel?: string;
}) {
  const source = useMemo(
    () => ({ ...(detail.institution as unknown as Record<string, unknown>), ...profileRecord(detail.profile) }),
    [detail],
  );
  const [initial] = useState(() => initialValues(fields, source));
  const [values, setValues] = useState<Values>(() => initialValues(fields, source));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const dirty = fields.some((field) => (values[field.key] ?? '') !== (initial[field.key] ?? ''));

  async function save() {
    const changed = changedValues(fields, values, initial);
    if (!Object.keys(changed).length) {
      setMessage('');
      setError('No changes to save.');
      return;
    }
    if ('official_name' in changed && !changed.official_name) {
      setError('The official name cannot be empty. Leave it unchanged if you do not have the wording yet.');
      return;
    }
    if ('school_name' in changed && !changed.school_name) {
      setError('The institution name cannot be empty.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const saved = await saveInstitutionProfileSection(detail.institution.id, section, changed);
      setMessage(`Saved ${section}. Verification is ${saved.verification_status.replace(/_/g, ' ')}, publication is ${saved.publication_status.replace(/_/g, ' ')}.`);
      onSaved('');
    } catch (e) {
      setError(saveError(e, 'Unable to save that section.'));
    } finally {
      setBusy(false);
    }
  }

  const verification = values.verification_status || detail.profile?.verification_status || 'unresearched';
  const publication = values.publication_status || detail.profile?.publication_status || 'draft';

  return (
    <div>
      <Messages error={error} message={message} />
      <FieldGrid
        fields={fields}
        values={values}
        disabled={busy}
        onChange={(key, value) => setValues((current) => ({ ...current, [key]: value }))}
      />
      {section === 'verification' && (
        <p className="muted" style={{ marginTop: 12 }}>
          Verification is {verification.replace(/_/g, ' ')}; publication is {publication.replace(/_/g, ' ')}.
          {' '}Public visibility needs both: a row is shown only when it is verified <em>and</em> published.
          {publication === 'published' && verification !== 'verified' && (
            <> Publishing is refused while the facts are unverified — that refusal is the gate, not a bug.</>
          )}
        </p>
      )}
      <div className="admin-news-editor-actions" style={{ marginTop: 12 }}>
        <button type="button" className="admin-btn" onClick={() => void save()} disabled={busy} aria-busy={busy}>
          {busy ? 'Saving…' : saveLabel}
        </button>
        {dirty && <span className="admin-filter-count">Unsaved changes</span>}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* One record, one form                                                      */
/* -------------------------------------------------------------------------- */

function RowEditor({
  title,
  subtitle,
  fields,
  source,
  build,
  saveLabel,
  onSave,
}: {
  title: string;
  subtitle: string;
  fields: FieldSpec[];
  source: Record<string, unknown>;
  /** Return a patch, or a sentence explaining what is missing. */
  build: (values: Values) => Record<string, unknown> | string;
  saveLabel: string;
  onSave: (patch: Record<string, unknown>) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [values, setValues] = useState<Values>(() => initialValues(fields, source));

  async function save() {
    const patch = build(values);
    if (typeof patch === 'string') { setError(patch); return; }
    setBusy(true);
    setError('');
    try {
      await onSave(patch);
      setOpen(false);
    } catch (e) {
      setError(saveError(e, 'Unable to save that record.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-card" style={{ padding: 12, marginBottom: 10 }}>
      <div className="admin-card-header" style={{ marginBottom: 6 }}>
        <div>
          <strong>{title}</strong>
          <p className="muted" style={{ margin: '2px 0' }}>{subtitle}</p>
        </div>
        <button type="button" className="admin-btn secondary" onClick={() => setOpen((current) => !current)}>
          {open ? 'Close' : 'Edit'}
        </button>
      </div>
      {open && (
        <div>
          <Messages error={error} />
          <FieldGrid
            fields={fields}
            values={values}
            disabled={busy}
            onChange={(key, value) => setValues((current) => ({ ...current, [key]: value }))}
          />
          <div className="admin-news-editor-actions" style={{ marginTop: 12 }}>
            <button type="button" className="admin-btn" onClick={() => void save()} disabled={busy} aria-busy={busy}>
              {busy ? 'Saving…' : saveLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddForm({
  label,
  fields,
  empty,
  build,
  addLabel,
  onSave,
}: {
  label: string;
  fields: FieldSpec[];
  empty: Values;
  build: (values: Values) => Record<string, unknown> | string;
  addLabel: string;
  onSave: (patch: Record<string, unknown>) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [values, setValues] = useState<Values>(empty);

  async function save() {
    const patch = build(values);
    if (typeof patch === 'string') { setError(patch); return; }
    setBusy(true);
    setError('');
    try {
      await onSave(patch);
      setValues(empty);
      setOpen(false);
    } catch (e) {
      setError(saveError(e, 'Unable to add that record.'));
    } finally {
      setBusy(false);
    }
  }

  if (!open) return <button type="button" className="admin-btn secondary" onClick={() => setOpen(true)}>{label}</button>;

  return (
    <div className="admin-card" style={{ padding: 12 }}>
      <Messages error={error} />
      <FieldGrid
        fields={fields}
        values={values}
        disabled={busy}
        onChange={(key, value) => setValues((current) => ({ ...current, [key]: value }))}
      />
      <div className="admin-news-editor-actions" style={{ marginTop: 10 }}>
        <button type="button" className="admin-btn" onClick={() => void save()} disabled={busy} aria-busy={busy}>{busy ? 'Saving…' : addLabel}</button>
        <button type="button" className="admin-btn secondary" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}

function unitOptions(units: InstitutionAdminUnit[], excludeId?: string): Array<{ value: string; label: string }> {
  return units
    .filter((unit) => unit.id !== excludeId)
    .map((unit) => ({ value: unit.id, label: `${unit.unit_type} · ${unit.unit_name}` }));
}

function unitPath(unit: InstitutionAdminUnit, byId: Map<string, InstitutionAdminUnit>): string {
  const parts: string[] = [unit.unit_name];
  let parent = unit.parent_unit_id ? byId.get(unit.parent_unit_id) : undefined;
  let guard = 0;
  while (parent && guard < 6) {
    parts.unshift(parent.unit_name);
    parent = parent.parent_unit_id ? byId.get(parent.parent_unit_id) : undefined;
    guard += 1;
  }
  return parts.join(' › ');
}

/* -------------------------------------------------------------------------- */
/* The editor                                                                */
/* -------------------------------------------------------------------------- */

export default function InstitutionReviewEditor({
  detail,
  onChanged,
}: {
  detail: InstitutionAdminDetail;
  onChanged: (message: string) => void;
}) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const unitsById = useMemo(() => new Map(detail.units.map((unit) => [unit.id, unit])), [detail.units]);
  const programmeById = useMemo(() => new Map(detail.offerings.map((row) => [row.id, row])), [detail.offerings]);
  const checksByKey = useMemo(() => new Map(detail.checklist.map((check) => [check.key, check])), [detail.checklist]);

  function note(saved: string) {
    setError('');
    setMessage(saved);
    if (saved) onChanged(saved);
  }

  const profile = detail.profile;
  const reviewer = profile?.reviewed_by ? detail.reviewers[profile.reviewed_by] ?? profile.reviewed_by : 'nobody yet';

  return (
    <div>
      <Messages error={error} message={message} />

      <section className="admin-card" style={{ padding: 18, marginBottom: 18 }}>
        <div className="admin-card-header">
          <div>
            <h2 style={{ margin: 0 }}>{detail.institution.school_name}</h2>
            <p className="muted" style={{ margin: '4px 0' }}>
              Verification: {profile?.verification_status?.replace(/_/g, ' ') ?? 'unresearched'}
              {' · '}Publication: {profile?.publication_status ?? 'draft'}
              {' · '}Last checked: {profile?.last_checked_at ? profile.last_checked_at.slice(0, 10) : 'never'}
              {' · '}Reviewer: {reviewer}
            </p>
          </div>
          <span className="admin-pill">{detail.units.length} units · {detail.offerings.length} programmes · {detail.evidence.length} evidence rows</span>
        </div>
        <ul className="admin-check-list" style={{ listStyle: 'none', padding: 0, margin: '10px 0 0', display: 'grid', gap: 4 }}>
          {detail.checklist.map((check) => <CheckLine key={check.key} check={check} />)}
        </ul>
        <p className="muted" style={{ marginTop: 10 }}>
          A missing line means nobody has researched it yet. It never means the institution lacks it, and the public page omits it rather than saying so.
        </p>
      </section>

      <Section number={1} title="Identity" description="The name, ownership, category and location. Saving the identity also corrects the school-finder row.">
        <ProfileSectionForm section="identity" fields={IDENTITY_FIELDS} detail={detail} onSaved={note} />
      </Section>

      <Section number={2} title="History, overview and mandate" description="Long-form text exactly as the institution publishes it. Research notes belong in section 10.">
        <ProfileSectionForm section="history" fields={HISTORY_FIELDS} detail={detail} onSaved={note} />
      </Section>

      <Section number={3} title="Website and portals" description="Official addresses only. An aggregator link is not an official portal.">
        <ProfileSectionForm section="portals" fields={PORTAL_FIELDS} detail={detail} onSaved={note} />
      </Section>

      <Section number={4} title="Images" description="Logo and campus photograph. EduReach links to the institution's own image; it does not claim to own a copy.">
        {detail.profile?.logo_url || detail.profile?.hero_image_url ? (
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap' }}>
            {detail.profile.logo_url && (
              <OptimizedImage
                src={detail.profile.logo_url}
                alt={`${detail.institution.school_name} logo`}
                width={96}
                height={96}
                layout="row"
                attribution="Image from the institution"
              />
            )}
            {detail.profile.hero_image_url && (
              <OptimizedImage
                src={detail.profile.hero_image_url}
                alt={`${detail.institution.school_name} campus`}
                width={320}
                height={180}
                layout="card"
                attribution="Image from the institution"
              />
            )}
          </div>
        ) : (
          <p className="muted" style={{ marginTop: 0 }}>
            No logo or campus photograph recorded. The public page omits the space rather than showing a stock campus.
          </p>
        )}
        <ProfileSectionForm section="images" fields={IMAGE_FIELDS} detail={detail} onSaved={note} />
      </Section>

      <Section
        number={5}
        title="Academic units"
        description="Faculty → department → programme. A unit is a row, so renaming one department never rewrites the institution."
        actions={<span className="admin-filter-count">{detail.units.length} recorded</span>}
      >
        {checksByKey.get('units') && <ul className="admin-check-list" style={{ listStyle: 'none', padding: 0, margin: '0 0 8px' }}><CheckLine check={checksByKey.get('units')!} /></ul>}
        {detail.units.length === 0
          ? <p className="muted">No academic unit recorded yet. Add the faculty or department as its own row; leave it unverified until a source states it.</p>
          : detail.units.map((unit) => (
            <div key={unit.id}>
              <p className="admin-section-label" style={{ margin: '6px 0 2px' }}>{unitPath(unit, unitsById)}</p>
              <RowEditor
                title={unit.unit_name}
                subtitle={`${unit.unit_type} · ${unit.verification_status.replace(/_/g, ' ')} · ${unit.is_active ? 'active' : 'inactive'}`}
                fields={[UNIT_FIELDS[0], UNIT_FIELDS[1], { ...UNIT_FIELDS[2], options: unitOptions(detail.units, unit.id) }, ...UNIT_FIELDS.slice(3)]}
                source={unit as unknown as Record<string, unknown>}
                saveLabel="Save unit"
                build={(values) => {
                  const patch: Record<string, unknown> = {
                    unit_type: values.unit_type,
                    unit_name: values.unit_name,
                    parent_unit_id: values.parent_unit_id || null,
                    verification_status: values.verification_status,
                    source_url: values.source_url.trim() || null,
                    review_note: values.review_note.trim() || null,
                  };
                  const active = boolOrNull(values.is_active);
                  if (active !== null) patch.is_active = active;
                  return patch;
                }}
                onSave={async (patch) => {
                  await updateInstitutionUnit(unit.id, patch);
                  note(`Saved ${unit.unit_name}.`);
                }}
              />
            </div>
          ))}
        <AddForm
          label="Add academic unit"
          addLabel="Add unit"
          fields={[
            { ...UNIT_FIELDS[0], options: UNIT_TYPES },
            UNIT_FIELDS[1],
            { ...UNIT_FIELDS[2], options: unitOptions(detail.units) },
            UNIT_FIELDS[3],
          ]}
          empty={{ unit_type: 'department', unit_name: '', parent_unit_id: '', verification_status: 'unresearched' }}
          build={(values) => {
            if (!values.unit_name.trim()) return 'A unit needs a name.';
            return {
              unit_type: values.unit_type,
              unit_name: values.unit_name.trim(),
              parent_unit_id: values.parent_unit_id || null,
              verification_status: values.verification_status,
            };
          }}
          onSave={async (patch) => {
            await createInstitutionUnit(detail.institution.id, patch);
            note(`Added ${String(patch.unit_name)}. It is not public until it is verified and its programmes are published.`);
          }}
        />
      </Section>

      <Section
        number={6}
        title="Programmes"
        description="Each programme carries its own verification and publication status. Publishing one leaves its unverified siblings private."
        actions={<span className="admin-filter-count">{detail.offerings.filter((row) => row.publication_status === 'published').length} published of {detail.offerings.length}</span>}
      >
        {detail.offerings.length === 0
          ? <p className="muted">No programme recorded yet.</p>
          : detail.offerings.map((programme: InstitutionAdminProgramme) => (
            <RowEditor
              key={programme.id}
              title={programme.programme_name}
              subtitle={[programme.programme_code, programme.award_level, programme.admission_session].filter(Boolean).join(' · ')
                || `No code, award or session recorded · ${programme.verification_status.replace(/_/g, ' ')} / ${programme.publication_status.replace(/_/g, ' ')}`}
              fields={[
                PROGRAMME_FIELDS[0], PROGRAMME_FIELDS[1],
                { ...PROGRAMME_FIELDS[2], options: unitOptions(detail.units) },
                ...PROGRAMME_FIELDS.slice(3),
              ]}
              source={programme as unknown as Record<string, unknown>}
              saveLabel="Save programme"
              build={(values) => {
                const patch: Record<string, unknown> = {
                  programme_name: values.programme_name,
                  programme_code: values.programme_code || null,
                  academic_unit_id: values.academic_unit_id || null,
                  degree_title: values.degree_title || null,
                  award_level: values.award_level || null,
                  duration_years: numberOrNull(values.duration_years),
                  admission_session: values.admission_session || null,
                  verification_status: values.verification_status,
                  publication_status: values.publication_status,
                  source_url: values.source_url.trim() || null,
                  review_note: values.review_note.trim() || null,
                };
                const active = boolOrNull(values.is_active);
                if (active !== null) patch.is_active = active;
                return patch;
              }}
              onSave={async (patch) => {
                await updateInstitutionProgramme(programme.id, patch);
                note(`Saved ${programme.programme_name}. Publishing this programme does not publish its siblings.`);
              }}
            />
          ))}
        <AddForm
          label="Add programme"
          addLabel="Add programme"
          fields={[
            PROGRAMME_FIELDS[0], PROGRAMME_FIELDS[1],
            { ...PROGRAMME_FIELDS[2], options: unitOptions(detail.units) },
            PROGRAMME_FIELDS[4], PROGRAMME_FIELDS[6],
          ]}
          empty={{ programme_name: '', programme_code: '', academic_unit_id: '', award_level: '', admission_session: '' }}
          build={(values) => {
            if (!values.programme_name.trim()) return 'A programme needs a name.';
            return {
              programme_name: values.programme_name.trim(),
              programme_code: values.programme_code.trim() || null,
              academic_unit_id: values.academic_unit_id || null,
              award_level: values.award_level || null,
              admission_session: values.admission_session || null,
            };
          }}
          onSave={async (patch) => {
            await createInstitutionProgramme(detail.institution.id, patch);
            note(`Added ${String(patch.programme_name)} as a draft programme.`);
          }}
        />
      </Section>

      <Section
        number={7}
        title="Admission routes"
        description="Sessions, entry modes and application windows. A window is only shown when a verified route states it."
        actions={<span className="admin-filter-count">{detail.admissionRoutes.length} routes</span>}
      >
        {detail.admissionRoutes.length === 0
          ? <p className="muted">No admission route recorded yet.</p>
          : detail.admissionRoutes.map((route: InstitutionAdminRoute) => (
            <RowEditor
              key={route.id}
              title={`${route.admission_session} · ${route.entry_mode.replace(/_/g, ' ')}`}
              subtitle={`${route.opens_on || 'no opening date'} → ${route.closes_on || 'no closing date'} · ${route.verification_status.replace(/_/g, ' ')} / ${route.publication_status.replace(/_/g, ' ')}`}
              fields={ROUTE_FIELDS}
              source={route as unknown as Record<string, unknown>}
              saveLabel="Save route"
              build={(values) => ({
                admission_session: values.admission_session,
                entry_mode: values.entry_mode,
                opens_on: values.opens_on || null,
                closes_on: values.closes_on || null,
                application_url: values.application_url.trim() || null,
                assessment_methods: commaList(values.assessment_methods),
                first_choice_required: boolOrNull(values.first_choice_required),
                change_of_institution_allowed: boolOrNull(values.change_of_institution_allowed),
                eligibility_notes: values.eligibility_notes.trim() || null,
                verification_status: values.verification_status,
                publication_status: values.publication_status,
                source_url: values.source_url.trim() || null,
                review_note: values.review_note.trim() || null,
              })}
              onSave={async (patch) => {
                await updateInstitutionAdmissionRoute(route.id, patch);
                note(`Saved the ${route.admission_session} ${route.entry_mode.replace(/_/g, ' ')} route. An empty date stays empty.`);
              }}
            />
          ))}
      </Section>

      <Section
        number={8}
        title="Entry requirements"
        description="Subject combinations and minimum scores, per programme and session. The scale is part of the number."
        actions={<span className="admin-filter-count">{detail.requirements.length} requirement sets</span>}
      >
        {detail.requirements.length === 0
          ? <p className="muted">No requirement recorded yet. Nothing is inferred from a similar institution.</p>
          : detail.requirements.map((requirement: InstitutionAdminRequirement) => (
            <RowEditor
              key={requirement.id}
              title={programmeById.get(requirement.programme_offering_id)?.programme_name ?? 'Programme'}
              subtitle={`${requirement.admission_session} · ${requirement.entry_mode.replace(/_/g, ' ')} · ${(requirement.utme_subjects ?? []).length ? `UTME: ${(requirement.utme_subjects ?? []).join(', ')}` : 'no UTME subjects recorded'} · ${requirement.verification_status.replace(/_/g, ' ')} / ${requirement.publication_status.replace(/_/g, ' ')}`}
              fields={REQUIREMENT_FIELDS}
              source={{
                ...(requirement as unknown as Record<string, unknown>),
                o_level_credits: levelField(requirement.o_level_requirements, 'credits'),
                o_level_subjects: levelField(requirement.o_level_requirements, 'subjects'),
                o_level_summary: levelField(requirement.o_level_requirements, 'summary'),
                a_level_credits: levelField(requirement.a_level_requirements, 'credits'),
                a_level_subjects: levelField(requirement.a_level_requirements, 'subjects'),
                a_level_summary: levelField(requirement.a_level_requirements, 'summary'),
              }}
              saveLabel="Save requirements"
              build={(values) => {
                const patch: Record<string, unknown> = {
                  admission_session: values.admission_session,
                  entry_mode: values.entry_mode,
                  utme_subjects: commaList(values.utme_subjects),
                  notes: values.notes.trim() || null,
                  verification_status: values.verification_status,
                  publication_status: values.publication_status,
                  source_url: values.source_url.trim() || null,
                  review_note: values.review_note.trim() || null,
                  o_level: {
                    credits: numberOrNull(values.o_level_credits),
                    subjects: values.o_level_subjects.trim() === '' ? null : commaList(values.o_level_subjects),
                    summary: values.o_level_summary.trim() || null,
                  },
                  a_level: {
                    credits: numberOrNull(values.a_level_credits),
                    subjects: values.a_level_subjects.trim() === '' ? null : commaList(values.a_level_subjects),
                    summary: values.a_level_summary.trim() || null,
                  },
                };
                if (values.minimum_utme_score.trim() !== '') patch.minimum_utme_score = Number(values.minimum_utme_score);
                if (values.minimum_utme_scale.trim() !== '') patch.minimum_utme_scale = Number(values.minimum_utme_scale);
                return patch;
              }}
              onSave={async (patch) => {
                await updateInstitutionRequirement(requirement.id, patch);
                note(`Saved the ${requirement.admission_session} ${requirement.entry_mode.replace(/_/g, ' ')} requirements.`);
              }}
            />
          ))}
        <p className="muted" style={{ marginTop: 8 }}>
          A minimum score is published with its scale. It is the institution’s stated minimum, never an estimate and never a departmental threshold nobody published.
        </p>
      </Section>

      <Section
        number={9}
        title="Sources and evidence"
        description="Every claim, the page that states it, and the reviewer's note. Correcting a source replaces the link; it never deletes the evidence."
        actions={<span className="admin-filter-count">{detail.evidence.length} rows</span>}
      >
        {detail.evidence.length === 0
          ? <p className="muted">No evidence recorded yet. A claim without a source stays unverified by design.</p>
          : detail.evidence.map((row) => (
            <EvidenceRowEditor key={row.id} row={row} reviewer={row.checked_by ? detail.reviewers[row.checked_by] ?? null : null} onSaved={note} />
          ))}
      </Section>

      <Section
        number={10}
        title="Verification and publication"
        description="Two separate decisions. Verification says a source was checked; publication says students may see it. Only both together make a row public."
      >
        <ProfileSectionForm section="verification" fields={VERIFICATION_FIELDS} detail={detail} onSaved={note} saveLabel="Save review state" />
        <p className="muted" style={{ marginTop: 10 }}>
          Public rule: {detail.gate.rule}. {detail.gate.profile.ok
            ? 'This profile currently satisfies it.'
            : 'The profile does not satisfy it yet, so it is not shown publicly. The API refuses that save with an explanation rather than silently publishing.'}
        </p>
      </Section>

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" className="admin-btn secondary" onClick={() => onChanged('')}>Back to the queue</button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 9: sources and evidence                                                   */
/* -------------------------------------------------------------------------- */

function levelField(value: unknown, key: string): string {
  if (!value || typeof value !== 'object') return '';
  const found = (value as Record<string, unknown>)[key];
  if (found === null || found === undefined) return '';
  if (Array.isArray(found)) return found.join(', ');
  return String(found);
}

function EvidenceRowEditor({
  row,
  reviewer,
  onSaved,
}: {
  row: InstitutionEvidenceRow;
  reviewer: string | null;
  onSaved: (message: string) => void;
}) {
  const [note, setNote] = useState(row.review_note ?? '');
  const [sourceUrl, setSourceUrl] = useState(row.source_url ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  const cannotVerify = !row.source_url && !sourceUrl.trim();

  async function decide(status: InstitutionEvidenceRow['verification_status']) {
    if (status === 'verified' && cannotVerify) {
      setError('No source URL recorded. Add the page that states this before verifying it.');
      return;
    }
    if (status !== 'verified' && !note.trim()) {
      setError('A disputed, outdated or withdrawn claim needs a written reason on record.');
      return;
    }
    if (sourceUrl.trim() && sourceUrl.trim() !== (row.source_url ?? '')) {
      setError('Save the replacement source first. It is kept alongside the old one, so the correction is visible.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await reviewInstitutionEvidence(row.id, status, note.trim() || null);
      onSaved(`${row.field_key} recorded as ${status.replace(/_/g, ' ')}.`);
    } catch (e) {
      setError(saveError(e, 'Unable to record that review.'));
    } finally {
      setBusy(false);
    }
  }

  async function replaceSource() {
    if (!sourceUrl.trim()) { setError('Paste the URL that states this claim.'); return; }
    if (!note.trim()) { setError('Say what changed and where the new source states it, so the correction is reviewable.'); return; }
    setBusy(true);
    setError('');
    try {
      await updateInstitutionEvidence(row.id, { sourceUrl: sourceUrl.trim(), note: note.trim() });
      onSaved(`Source replaced on ${row.field_key}. The previous source stays in the record.`);
    } catch (e) {
      setError(saveError(e, 'Unable to replace that source.'));
    } finally {
      setBusy(false);
    }
  }

  async function addNote() {
    if (!note.trim()) { setError('Write the note first.'); return; }
    setBusy(true);
    setError('');
    try {
      await updateInstitutionEvidence(row.id, { note: note.trim() });
      onSaved(`Note added to ${row.field_key}.`);
    } catch (e) {
      setError(saveError(e, 'Unable to add that note.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-card" style={{ padding: 12, marginBottom: 10 }}>
      <div className="admin-card-header" style={{ marginBottom: 6 }}>
        <div>
          <strong>{row.entity_type} · {row.field_key}</strong>
          <p className="muted" style={{ margin: '2px 0' }}>
            {row.applicable_session ?? 'no session recorded'}
            {' · '}{row.verification_status.replace(/_/g, ' ')}
            {row.checked_at ? ` · checked ${row.checked_at.slice(0, 10)}` : ' · never checked'}
            {reviewer ? ` · ${reviewer}` : ''}
          </p>
        </div>
        <button type="button" className="admin-btn secondary" onClick={() => setOpen((current) => !current)}>{open ? 'Close' : 'Open evidence'}</button>
      </div>
      <p style={{ margin: '4px 0' }}>{textOf(row.claimed_value) || 'No value recorded'}</p>
      {row.source_url
        ? <a href={row.source_url} target="_blank" rel="noreferrer noopener">{row.source_url}</a>
        : <span className="danger-text">No source URL recorded — this cannot be verified.</span>}
      {open && (
        <div style={{ marginTop: 10 }}>
          <Messages error={error} />
          <div className="admin-field-row" style={{ flexWrap: 'wrap', gap: 12 }}>
            <label className="admin-field" style={{ flex: 2 }}><span>Source URL</span>
              <input className="admin-input" aria-label="Source URL" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} />
            </label>
            <label className="admin-field" style={{ flex: 2 }}><span>Review note</span>
              <input className="admin-input" aria-label="Review note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="What does the source actually say?" />
            </label>
          </div>
          <div className="admin-news-editor-actions" style={{ flexWrap: 'wrap', marginTop: 10 }}>
            <button type="button" className="admin-btn" onClick={() => void decide('verified')} disabled={busy || (row.verification_status === 'verified' && !sourceUrl.trim())} aria-busy={busy}>Verify</button>
            <button type="button" className="admin-btn secondary" onClick={() => void decide('disputed')} disabled={busy}>Dispute</button>
            <button type="button" className="admin-btn secondary" onClick={() => void decide('outdated')} disabled={busy}>Outdated</button>
            <button type="button" className="admin-btn secondary" onClick={() => void decide('unpublished_by_institution')} disabled={busy}>Withdrawn</button>
            <button type="button" className="admin-btn secondary" onClick={() => void replaceSource()} disabled={busy}>Replace source</button>
            <button type="button" className="admin-btn secondary" onClick={() => void addNote()} disabled={busy}>Add note</button>
          </div>
          <p className="muted" style={{ marginTop: 8 }}>
            Replacing a source never deletes the old link or this note. Evidence is corrected, not removed.
          </p>
        </div>
      )}
    </div>
  );
}
