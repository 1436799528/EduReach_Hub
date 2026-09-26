import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, MapPin, Search, School, X } from 'lucide-react';
import HubLayout from '../src/components/HubLayout';
import type { Institution } from '../src/components/dashboard/SchoolFinderCard';
import { itemKey } from '../src/components/dashboard/SchoolFinderCard';
import { commonInstitutions, institutionCourseContexts } from '../src/data/studentOptions';
import { isSupabaseConfigured, supabase } from '../src/lib/supabase';

function starterInstitutions(): Institution[] {
  return commonInstitutions.filter((name) => !name.startsWith('Other')).map((name, index) => {
    const match = name.match(/^(.*?)(?:\s+\(([^)]+)\))?$/);
    return { id: `starter-school-${index + 1}`, school_name: match?.[1] || name, acronym: match?.[2] || null, state: null, institution_type: 'University', website_url: null, course_context: institutionCourseContexts[match?.[2] || ''] || null };
  });
}

function navigateTo(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export default function SchoolFinderPage() {
  const params = new URLSearchParams(window.location.search);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [query, setQuery] = useState(params.get('school') || '');
  const [type, setType] = useState(params.get('type') || 'ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        if (!isSupabaseConfigured) {
          setInstitutions(starterInstitutions());
          return;
        }
        const { data, error: loadError } = await supabase.from('institutions').select('id,school_name,acronym,state,institution_type,website_url').order('school_name').limit(400);
        if (loadError) throw loadError;
        if (active) setInstitutions((data || []) as Institution[]);
      } catch (value) {
        if (active) {
          setError(value instanceof Error ? value.message : 'The school directory could not be loaded.');
          // Production never silently substitutes the maintained starter list
          // for a configured-but-failing directory; the starter list is only
          // the unconfigured local-preview source.
          if (!isSupabaseConfigured) setInstitutions(starterInstitutions());
          else setInstitutions([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const next = new URLSearchParams(window.location.search);
    if (query.trim()) next.set('school', query.trim()); else next.delete('school');
    if (type !== 'ALL') next.set('type', type); else next.delete('type');
    const suffix = next.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${suffix ? `?${suffix}` : ''}`);
  }, [query, type]);

  useEffect(() => {
    const syncFromUrl = () => {
      const next = new URLSearchParams(window.location.search);
      setQuery(next.get('school') || '');
      setType(next.get('type') || 'ALL');
    };
    window.addEventListener('popstate', syncFromUrl);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return institutions.filter((school) => {
      const haystack = [school.school_name, school.acronym, school.state, school.institution_type, school.course_context].filter(Boolean).join(' ').toLowerCase();
      const matchesTerm = !term || haystack.includes(term);
      const matchesType = type === 'ALL' || String(school.institution_type || '').toLowerCase().includes(type.toLowerCase());
      return matchesTerm && matchesType;
    }).slice(0, 80);
  }, [institutions, query, type]);

  const suggestions = query.trim() ? filtered.slice(0, 8) : [];

  return (
    <HubLayout>
      <div className="hub-page school-finder-page">
        <div className="hub-container school-finder-container">
          <div className="school-finder-head">
            <div><span className="hub-eyebrow">Student tools</span><h1>Find your school</h1><p>Search the maintained institution directory by name, acronym, location, type or a configured course tag.</p></div>
          </div>
          <section className="school-finder-search-card" aria-label="School search">
            <div className="school-finder-search-row">
              <div className="school-finder-search-input"><Search size={18} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search school, acronym, state or course..." aria-label="Search for a school" /><button type="button" onClick={() => setQuery('')} aria-label="Clear school search" disabled={!query}><X size={16} /></button></div>
              <select value={type} onChange={(event) => setType(event.target.value)} aria-label="Institution type"><option value="ALL">All institution types</option><option value="university">Universities</option><option value="polytechnic">Polytechnics</option><option value="college">Colleges</option></select>
            </div>
            {suggestions.length > 0 && <div className="school-finder-suggestions" role="listbox" aria-label="School suggestions">{suggestions.map((school) => <button type="button" role="option" key={school.id} onClick={() => setQuery(school.school_name)}><School size={15} /><span><strong>{school.school_name}</strong><small>{school.acronym ? `${school.acronym} · ` : ''}{school.state || 'Nigeria'}</small></span></button>)}</div>}
            <div className="school-finder-search-meta">{loading ? 'Loading verified directory…' : `${filtered.length} matching institution${filtered.length === 1 ? '' : 's'}`}</div>
          </section>

          {error && <div className="hub-alert hub-alert-info">The institution directory could not be loaded right now. Please try again in a moment.</div>}
          {!loading && !filtered.length && <div className="hub-panel hub-empty"><School size={24} /><h2>No school found</h2><p>Try an acronym, state or a shorter school name.</p></div>}
          <div className="school-finder-results">
            {filtered.map((school) => {
              const slug = itemKey(school.school_name);
              const detailPath = `/schools/${encodeURIComponent(slug)}?name=${encodeURIComponent(school.school_name)}&acronym=${encodeURIComponent(school.acronym || '')}&state=${encodeURIComponent(school.state || '')}&type=${encodeURIComponent(school.institution_type || '')}&website=${encodeURIComponent(school.website_url || '')}&course=${encodeURIComponent(school.course_context || '')}&return=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`;
              // Whole card is the link — no tiny nested button.
              return <a className="school-finder-result-card school-finder-result-card-link" key={school.id} href={detailPath} onClick={(event) => { if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); navigateTo(detailPath); }}><div className="school-finder-result-icon"><School size={20} /></div><div className="school-finder-result-copy"><h2>{school.school_name}</h2><p>{school.acronym && <b>{school.acronym} · </b>}{school.institution_type || 'Institution'} <span>·</span> <MapPin size={13} /> {school.state ? `${school.state} State` : 'Nigeria'}</p>{school.course_context && <small className="school-finder-course-tags">Course tags: {school.course_context.split(' ').slice(0, 6).join(', ')}{school.course_context.split(' ').length > 6 ? '…' : ''}</small>}</div><span className="hub-outline-btn er-card-cta">View school <ArrowRight size={14} /></span></a>;
            })}
          </div>
        </div>
      </div>
    </HubLayout>
  );
}
