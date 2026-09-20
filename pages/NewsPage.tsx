import { ArrowRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import CardIdentityMark from '../src/components/CardIdentityMark';
import { fetchNews, type NewsItem } from '../src/lib/api';

function labelFor(category: string) {
  return category.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null) {
  return value
    ? new Date(value).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Update';
}

function newsImageFor(item: NewsItem) {
  const category = item.category.toLowerCase();
  if (category.includes('jamb')) return 'https://i.pinimg.com/736x/ec/ce/9f/ecce9f34b9cf3bc867d301e43c326db3.jpg';
  if (category.includes('neco')) return 'https://i.pinimg.com/736x/b2/54/24/b254246163c37148203ed5f7c1144e9d.jpg';
  if (category.includes('waec') || category.includes('result')) return 'https://i.pinimg.com/736x/b7/5d/88/b75d8803cf1011910157dfd52f449365.jpg';
  if (category.includes('admission') || category.includes('screen')) return 'https://i.pinimg.com/736x/26/7a/e3/267ae39bd873640ba1710cffe18451c8.jpg';
  if (category.includes('scholarship') || category.includes('grant') || category.includes('fund')) return 'https://i.pinimg.com/736x/11/bc/7b/11bc7b6c4db6e280cbbebda9bfda821d.jpg';
  return '/news/education.svg';
}

export default function NewsPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');

  useEffect(() => {
    void fetchNews()
      .then(setItems)
      .catch((value) => setError(value instanceof Error ? value.message : 'Unable to load news.'))
      .finally(() => setLoading(false));
  }, []);

  const filteredItems = useMemo(() => {
    if (activeFilter === 'ALL') return items;
    return items.filter((item) =>
      item.category.toLowerCase().includes(activeFilter.toLowerCase())
    );
  }, [items, activeFilter]);

  return (
    <HubLayout>
      <div className="hub-page" style={{ padding: '20px 0 60px' }}>
        <div className="hub-container hub-narrow">
          <div className="hub-section-heading hub-page-heading-compact" style={{ marginBottom: '16px' }}>
            <div>
              <span className="hub-eyebrow" style={{ color: '#059669', fontWeight: 800 }}>
                CAMPUS NOTICEBOARD
              </span>
              <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', margin: '2px 0 4px' }}>
                News &amp; Updates
              </h1>
            </div>
            <a className="hub-outline-btn" href="/jobs" style={{ textDecoration: 'none', fontSize: '12px' }}>
              Scholarships &amp; Grants →
            </a>
          </div>

          {/* MYSCHOOL CATEGORY FILTER PILLS */}
          <div
            style={{
              display: 'flex',
              gap: '6px',
              flexWrap: 'wrap',
              marginBottom: '18px',
              paddingBottom: '12px',
              borderBottom: '1px solid #e2e8f0',
            }}
          >
            {[
              { id: 'ALL', label: 'All News' },
              { id: 'jamb', label: 'JAMB Updates' },
              { id: 'admission', label: 'Admission Lists' },
              { id: 'waec', label: 'WAEC News' },
              { id: 'neco', label: 'NECO Updates' },
              { id: 'nelfund', label: 'NELFUND Loan' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id)}
                style={{
                  border: '1px solid',
                  borderColor: activeFilter === tab.id ? '#059669' : '#e2e8f0',
                  background: activeFilter === tab.id ? '#059669' : '#ffffff',
                  color: activeFilter === tab.id ? '#ffffff' : '#475569',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {loading && <div className="hub-panel hub-empty">Loading updates…</div>}
          {error && <div className="hub-form-error">{error}</div>}
          {!loading && !error && !filteredItems.length && (
            <div className="hub-panel hub-empty">No announcements found matching this category.</div>
          )}

          {!loading && !error && filteredItems.length > 0 && (
            <div className="hub-news-feed" style={{ display: 'grid', gap: '10px' }}>
              {filteredItems.map((item) => (
                <a
                  className="hub-news-feed-row hub-click-card"
                  href={'/news/' + encodeURIComponent(item.slug)}
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '14px 16px',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    textDecoration: 'none',
                    color: '#0f172a',
                    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
                  }}
                >
                  <div className="hub-news-thumb" style={{ flexShrink: 0 }}>
                    <img src={newsImageFor(item)} alt="" loading="lazy" />
                  </div>
                  <div className="hub-feed-main" style={{ flex: 1, minWidth: 0 }}>
                    <div className="hub-news-meta" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#64748b', marginBottom: '3px' }}>
                      <span>
                        {labelFor(item.category)}
                      </span>
                      <span>•</span>
                      <span>{formatDate(item.published_at)}</span>
                      <span>•</span>
                      
                    </div>
                    <h2 style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', margin: '0 0 3px', lineHeight: 1.35 }}>
                      {item.title}
                    </h2>
                    
                  </div>
                  <ArrowRight size={15} className="hub-compact-arrow" style={{ color: '#cbd5e1', flexShrink: 0 }} />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </HubLayout>
  );
}
