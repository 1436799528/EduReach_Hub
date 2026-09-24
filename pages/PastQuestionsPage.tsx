import { BookOpen, Search, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import FilterPills from '../src/components/FilterPills';
import { pastQuestionLibrary } from '../src/data/examPreparation';

type Filter = 'ALL' | 'JAMB' | 'WAEC' | 'NECO' | 'Post-UTME';

const filters = [
  { id: 'ALL', label: 'All banks' },
  { id: 'JAMB', label: 'JAMB' },
  { id: 'WAEC', label: 'WAEC' },
  { id: 'NECO', label: 'NECO' },
  { id: 'Post-UTME', label: 'Post-UTME' },
];

export default function PastQuestionsPage() {
  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');

  const records = useMemo(() => {
    const query = search.trim().toLowerCase();
    return pastQuestionLibrary.filter((record) => {
      const matchesFilter = filter === 'ALL' || record.exam === filter;
      const searchable = `${record.title} ${record.school} ${record.year} ${record.subjects}`.toLowerCase();
      return matchesFilter && (!query || searchable.includes(query));
    });
  }, [filter, search]);

  return (
    <HubLayout>
      <main className="hub-page" style={{ padding: '22px 0 64px' }}>
        <div className="hub-container hub-narrow" style={{ maxWidth: '900px' }}>
          <div className="hub-section-heading hub-page-heading-compact">
            <div>
              <span className="hub-eyebrow" style={{ color: '#C85841' }}>QUESTION LIBRARY</span>
              <h1>Past Questions</h1>
              <p>Browse verified practice banks by examination body, school and subject before entering a timed session.</p>
            </div>
            <BookOpen size={28} color="#C85841" aria-hidden="true" />
          </div>

          <div className="er-library-toolbar">
            <label className="er-library-search">
              <Search size={17} aria-hidden="true" />
              <span className="er-visually-hidden">Search past questions</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search school, exam or subject" aria-label="Search past questions" />
            </label>
            <div className="er-library-filter-label"><SlidersHorizontal size={15} /> Filter</div>
            <FilterPills options={filters} active={filter} onChange={(value) => setFilter(value as Filter)} ariaLabel="Past question examination filters" />
          </div>

          <div className="er-library-note" role="note">
            <strong>How this library works</strong>
            <span>Each record opens a setup page first. Choose your course, school or subjects, then enter the CBT hall. Only question banks that have a catalogue record are shown; more verified school papers can be added without inventing documents.</span>
          </div>

          {!records.length ? (
            <div className="hub-panel hub-empty"><h2>No matching question bank</h2><p>Try a different examination body, school or subject.</p></div>
          ) : (
            <div className="er-library-grid">
              {records.map((record) => (
                <article className="er-library-card" key={record.id}>
                  <div className="er-library-card-top">
                    <span className="er-library-badge">{record.exam}</span>
                    <span>{record.year}</span>
                  </div>
                  <h2>{record.title}</h2>
                  <p className="er-library-school">{record.school}</p>
                  <p>{record.description}</p>
                  <div className="er-library-subjects"><strong>Subjects</strong><span>{record.subjects}</span></div>
                  <a className="hub-primary-btn" href={record.href}>Set up practice <span aria-hidden="true">→</span></a>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
    </HubLayout>
  );
}
