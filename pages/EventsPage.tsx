import { CalendarDays, Clock3, MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import { identityClassFor } from '../src/components/CardIdentityMark';
import { fetchUpcoming, type UpcomingItem } from '../src/lib/api';
import { SkeletonRows } from '../src/components/Skeleton';

function eventDate(item: UpcomingItem) {
  const value = item.starts_at || item.due_at;
  return value ? new Date(value).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }) : 'Date to be announced';
}

export default function EventsPage() {
  const [events, setEvents] = useState<UpcomingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadEvents() {
    setLoading(true);
    setError('');
    try {
      setEvents(await fetchUpcoming());
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to load upcoming events.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadEvents(); }, []);

  return (
    <HubLayout>
      <main className="hub-page" style={{ padding: '22px 0 64px' }}>
        <div className="hub-container hub-narrow" style={{ maxWidth: '820px' }}>
          <div className="hub-section-heading hub-page-heading-compact">
            <div>
              <span className="hub-eyebrow" style={{ color: '#C85841' }}>NOTICEBOARD CALENDAR</span>
              <h1>Upcoming events</h1>
              <p>Only future deadlines and examination events published through the EduReach calendar appear here.</p>
            </div>
            <CalendarDays size={28} color="#C85841" aria-hidden="true" />
          </div>

          {loading && <SkeletonRows rows={4} label="Loading upcoming events" />}
          {error && <div className="hub-form-error" role="alert" style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}><span>{error}</span><button type="button" className="hub-outline-btn" onClick={() => void loadEvents()} disabled={loading}>Try again</button></div>}
          {!loading && !error && !events.length && <div className="hub-panel hub-empty"><h2>No upcoming events yet</h2><p>There are no future deadlines or examination events published at the moment. Check the noticeboard again when a verified date is available.</p></div>}
          {!loading && !error && events.length > 0 && (
            <div className="er-events-list">
              {events.map((item) => (
                <article className={`er-event-card ${identityClassFor(`${item.kind} ${item.title}`, 'upcoming')}`} key={item.id}>
                  <div className="er-event-date"><strong>{new Date(item.starts_at || item.due_at || Date.now()).getDate()}</strong><span>{new Date(item.starts_at || item.due_at || Date.now()).toLocaleDateString('en-NG', { month: 'short' })}</span></div>
                  <div className="er-event-copy"><span className="er-library-badge">{item.kind === 'exam' ? 'Exam event' : 'Deadline'}</span><h2>{item.title}</h2><p>{item.description || 'Check the official notice for the full event details.'}</p><div className="er-event-meta"><span><Clock3 size={13} /> {eventDate(item)}</span>{item.location && <span><MapPin size={13} /> {item.location}</span>}</div></div>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
    </HubLayout>
  );
}
