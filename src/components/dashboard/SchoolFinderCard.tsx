import { useState } from 'react';
import { School } from 'lucide-react';
import type { DashboardSavedItemInput } from '../../lib/studentDashboard';

export type Institution = {
  id: string;
  school_name: string;
  acronym?: string | null;
  state?: string | null;
  institution_type?: string | null;
  website_url?: string | null;
};

export const itemKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

/** Verified institution directory with a "save to shortlist" action. */
export default function SchoolFinderCard({
  institutions,
  isSaved,
  onSave,
}: {
  institutions: Institution[];
  isSaved: (type: DashboardSavedItemInput['type'], key: string) => boolean;
  onSave: (input: DashboardSavedItemInput) => void;
}) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('ALL');

  const filtered = institutions
    .filter((school) => {
      const haystack = [school.school_name, school.acronym, school.state].filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(query.trim().toLowerCase())) return false;
      if (type === 'ALL') return true;
      return String(school.institution_type || '').toLowerCase().includes(type.toLowerCase());
    })
    .slice(0, 40);

  return (
    <section className="dash-card" id="school-finder">
      <div className="dash-card-header">
        <h2 className="dash-card-title"><School size={14} className="dash-card-title-icon" /> School Finder</h2>
        <span className="dash-card-meta">{institutions.length ? `${institutions.length} institutions` : 'Directory'}</span>
      </div>

      <div className="dash-finder-controls">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by school name, acronym or state" aria-label="Search institutions" />
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Institution type">
          <option value="ALL">All institutions</option>
          <option value="Federal">Federal universities</option>
          <option value="State">State universities</option>
          <option value="Private">Private universities</option>
          <option value="Polytechnic">Polytechnics</option>
          <option value="College">Colleges of education</option>
        </select>
      </div>

      {!institutions.length && (
        <div className="dash-empty">
          The verified institution directory is only available on a connected account. Sign in with your EduReach account to browse schools and save a shortlist.
        </div>
      )}
      {institutions.length > 0 && !filtered.length && <div className="dash-empty">No institutions match this search. Try a different name or state.</div>}

      {filtered.length > 0 && (
        <ul className="dash-list">
          {filtered.map((school) => {
            const key = itemKey(school.school_name);
            const saved = isSaved('school', key);
            return (
              <li key={school.id} className="dash-list-row">
                <div className="dash-list-copy">
                  <strong>{school.school_name}</strong>
                  <span>{school.institution_type || 'Institution'}{school.acronym ? ` (${school.acronym})` : ''} • {school.state ? `${school.state} State` : 'Nigeria'}</span>
                </div>
                <div className="dash-list-actions">
                  <button
                    type="button"
                    className={`dash-btn dash-btn-small ${saved ? 'is-saved' : 'dash-btn-secondary'}`}
                    disabled={saved}
                    onClick={() => onSave({ type: 'school', key, name: school.school_name, detail: school.institution_type || 'Institution', location: school.state ? `${school.state} State` : 'Nigeria', href: school.website_url || undefined })}
                  >
                    {saved ? 'Saved' : 'Save'}
                  </button>
                  {school.website_url && (
                    <a className="dash-btn dash-btn-small dash-btn-secondary" href={school.website_url} target="_blank" rel="noopener noreferrer">Portal ↗</a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
