import { useEffect, useState } from 'react';
import { Download, ExternalLink, FileText } from 'lucide-react';
import { fetchPublicPdfDocuments, type PublicPdfDocument } from '../lib/api';

type Destination = 'admission_guides'|'scholarships'|'news_attachments'|'school_resources';

export default function PublicPdfList({
  destination,
  title,
  institutionId,
  opportunityId,
  newsArticleId,
}: {
  destination: Destination;
  title: string;
  institutionId?: string | null;
  opportunityId?: string | null;
  newsArticleId?: string | null;
}) {
  const [items, setItems] = useState<PublicPdfDocument[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const needsInstitution = destination === 'admission_guides' || destination === 'school_resources';
    if ((needsInstitution && !institutionId) || (destination === 'scholarships' && !opportunityId) || (destination === 'news_attachments' && !newsArticleId)) {
      setItems([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    fetchPublicPdfDocuments({ destination, institutionId: institutionId || undefined, opportunityId: opportunityId || undefined, newsArticleId: newsArticleId || undefined })
      .then((rows) => { if (active) setItems(rows); })
      .catch(() => { if (active) setItems([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [destination, institutionId, opportunityId, newsArticleId]);

  if (!loading && items.length === 0) return null;
  return (
    <section className="er-section" style={{ marginTop: 22 }}>
      <h2 style={{ fontSize: 17, margin: '0 0 12px' }}>{title}</h2>
      {loading ? <p className="hub-muted-label">Loading documents…</p> : (
        <div style={{ display: 'grid', gap: 10 }}>
          {items.map((item) => {
            const href = item.href || item.source_url;
            return (
              <article key={item.id} className="hub-card" style={{ padding: 14, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <FileText size={20} aria-hidden="true" />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <strong>{item.title}</strong>
                  {item.description && <p style={{ margin: '5px 0', lineHeight: 1.5 }}>{item.description}</p>}
                  <small className="hub-muted-label">{[item.source_name, item.subject, item.course, item.paper_year].filter(Boolean).join(' · ')}</small>
                  {href && <div style={{ marginTop: 8 }}><a href={href} target="_blank" rel="noreferrer" className="hub-card-link">{item.href ? <><Download size={14} /> Open PDF</> : <>Open source <ExternalLink size={14} /></>}</a></div>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
