import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, School } from 'lucide-react';
import type { DashboardSavedItemInput } from '../../lib/studentDashboard';

export type Institution = {
  id: string;
  school_name: string;
  acronym?: string | null;
  state?: string | null;
  institution_type?: string | null;
  website_url?: string | null;
  course_context?: string | null;
};

export const itemKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

function detailPath(school: Institution, returnPath: string) {
  return `/schools/${encodeURIComponent(itemKey(school.school_name))}?name=${encodeURIComponent(school.school_name)}&acronym=${encodeURIComponent(school.acronym || '')}&state=${encodeURIComponent(school.state || '')}&type=${encodeURIComponent(school.institution_type || '')}&website=${encodeURIComponent(school.website_url || '')}&course=${encodeURIComponent(school.course_context || '')}&return=${encodeURIComponent(returnPath)}`;
}

/** Verified institution directory with search, autocomplete and shortlist actions. */
export default function SchoolFinderCard({
  institutions,
  isSaved,
  onSave,
}: {
  institutions: Institution[];
  isSaved: (type: DashboardSavedItemInput['type'], key: string) => boolean;
  onSave: (input: DashboardSavedItemInput) => void;
}) {
  const searchParams = new URLSearchParams(window.location.search);
  const [query, setQuery] = useState(searchParams.get('school') || '');
  const [type, setType] = useState(searchParams.get('schoolType') || 'ALL');

  useEffect(() => {
    const next = new URLSearchParams(window.location.search);
    if (query.trim()) next.set('school', query.trim()); else next.delete('school');
    if (type !== 'ALL') next.set('schoolType', type); else next.delete('schoolType');
    const suffix = next.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${suffix ? `?${suffix}` : ''}`);
  }, [query, type]);

  useEffect(() => {
    const syncFromUrl = () => {
      const next = new URLSearchParams(window.location.search);
      setQuery(next.get('school') || '');
      setType(next.get('schoolType') || 'ALL');
    };
    window.addEventListener('popstate', syncFromUrl);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, []);

  const filtered = useMemo(() => institutions.filter((school) => {
      const haystack = [school.school_name, school.acronym, school.state, school.institution_type, school.course_context].filter(Boolean).join(' ').toLowerCase();
    if (!haystack.includes(query.trim().toLowerCase())) return false;
    if (type === 'ALL') return true;
    return String(school.institution_type || '').toLowerCase().includes(type.toLowerCase());
  }).slice(0, 40), [institutions, query, type]);
  const suggestions = query.trim() ? filtered.slice(0, 6) : [];
  const returnPath = `${window.location.pathname}${window.location.search}`;

  return (
    <section className="dash-card" id="school-finder">
      <div className="dash-card-header">
        <h2 className="dash-card-title"><School size={14} className="dash-card-title-icon" /> School Finder</h2>
        <a className="dash-card-link" href="/schools">Open full finder <ArrowRight size={13} /></a>
      </div>
      <p className="dash-card-help">Search by school name, acronym, state, type or a configured course tag. Course tags are limited search hints, not a full programme catalogue.</p>

      <div className="dash-finder-controls dash-finder-autocomplete">
        <div className="dash-finder-search-wrap"><input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="School, state or course..." aria-label="Search institutions" />{suggestions.length > 0 && <div className="dash-finder-suggestions" role="listbox">{suggestions.map((school) => <button type="button" key={school.id} onClick={() => setQuery(school.school_name)}><strong>{school.school_name}</strong><span>{school.acronym || school.state || 'Institution'}</span></button>)}</div>}</div>
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Institution type"><option value="ALL">All institutions</option><option value="Federal">Federal universities</option><option value="State">State universities</option><option value="Private">Private universities</option><option value="Polytechnic">Polytechnics</option><option value="College">Colleges</option></select>
      </div>

      {!institutions.length && <div className="dash-empty">The maintained institution directory is not available right now. Open the full finder later or try again when the directory is connected.</div>}
      {institutions.length > 0 && !filtered.length && <div className="dash-empty">No school matches this search. Try an acronym, state or shorter name.</div>}

      {filtered.length > 0 && <ul className="dash-list">{filtered.map((school) => {
        const key = itemKey(school.school_name);
        const saved = isSaved('school', key);
        return <li key={school.id} className="dash-list-row"><div className="dash-list-copy"><strong>{school.school_name}</strong><span>{school.institution_type || 'Institution'}{school.acronym ? ` (${school.acronym})` : ''} · {school.state ? `${school.state} State` : 'Nigeria'}</span></div><div className="dash-list-actions"><a className="dash-btn dash-btn-small dash-btn-secondary" href={detailPath(school, returnPath)}>Details</a><button type="button" className={`dash-btn dash-btn-small ${saved ? 'is-saved' : 'dash-btn-secondary'}`} disabled={saved} onClick={() => onSave({ type: 'school', key, name: school.school_name, detail: school.institution_type || 'Institution', location: school.state ? `${school.state} State` : 'Nigeria', href: school.website_url || undefined })}>{saved ? 'Saved' : 'Save'}</button></div></li>;
      })}</ul>}
    </section>
  );
}
