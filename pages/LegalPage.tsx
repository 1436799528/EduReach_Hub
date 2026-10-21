import { useEffect } from 'react';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import HubLayout from '../src/components/HubLayout';
import { useSiteContent } from '../src/components/useSiteContent';
import { sanitizeRichHtml } from '../src/lib/html-sanitize';
import { isPolicySlug, type PolicySlug } from '../src/lib/siteContentModel';

/**
 * A policy page: privacy, terms, cookies, accessibility, disclaimer or contact.
 *
 * The text is stored in `site_pages` and edited in the admin portal, so a policy
 * update does not need a deploy. Until an editor marks a page as legally
 * reviewed, the page says so in a banner - the one thing a policy page must
 * never do is imply an approval nobody gave.
 */

function formatDate(value: string | null): string {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
}

export default function LegalPage({ slug }: { slug: string }) {
  const { content, source } = useSiteContent();
  const page = isPolicySlug(slug) ? content.pages.find((entry) => entry.slug === slug) ?? null : null;

  useEffect(() => {
    document.title = page ? `${page.title} | EduReach Hub` : 'Page not found | EduReach Hub';
  }, [page]);

  const updated = formatDate(page?.updatedAt ?? null);

  return (
    <HubLayout>
      <div className="er-legal-page">
        <div className="hub-container er-legal-container">
          <a className="er-legal-back" href="/">
            <ArrowLeft size={14} aria-hidden="true" /> Back to EduReach
          </a>

          {!page && source === 'live' && (
            <div className="er-legal-missing">
              <h1>This page is not published</h1>
              <p>
                The page you followed is not available right now. It may be under revision. Go back to the{' '}
                <a href="/">home page</a> or <a href="/contact">contact us</a> if you need this information today.
              </p>
            </div>
          )}

          {!page && source !== 'live' && (
            <div className="er-legal-missing" role="status">
              <h1>Loading this page…</h1>
              <p>If it does not appear, check your connection and reload.</p>
            </div>
          )}

          {page && (
            <article className="er-legal-article" aria-labelledby="legal-title">
              {page.reviewState !== 'approved' && (
                <div className="er-legal-draft" role="note">
                  <ShieldAlert size={18} aria-hidden="true" />
                  <p>
                    <strong>Draft pending legal review.</strong> This page describes how EduReach Hub works today, but
                    it has not yet been reviewed by a lawyer. If you need to rely on it for a decision, contact us.
                  </p>
                </div>
              )}

              <header className="er-legal-head">
                <span className="hub-eyebrow">EduReach policies</span>
                <h1 id="legal-title">{page.title}</h1>
                {page.summary && <p className="er-legal-summary">{page.summary}</p>}
                <p className="er-legal-meta">
                  {updated ? `Last updated ${updated}` : 'Publication date not recorded'}
                  {page.revision > 1 ? ` · version ${page.revision}` : ''}
                </p>
              </header>

              <div
                className="er-legal-body"
                /* Stored HTML is sanitised on render: the editor is staff, but the
                   renderer is what every visitor's browser trusts. */
                dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(page.body) }}
              />
            </article>
          )}

          <footer className="er-legal-foot">
            <p>
              Something here wrong or unclear? <a href="/contact">Tell us</a> and we will fix the page rather than
              leave it misleading.
            </p>
            <nav aria-label="Other policies">
              {[
                ['privacy', 'Privacy'],
                ['terms', 'Terms'],
                ['cookies', 'Cookies'],
                ['accessibility', 'Accessibility'],
                ['disclaimer', 'Disclaimer'],
                ['contact', 'Contact'],
              ].map(([key, label]) => (
                <a key={key} href={`/${key}`} aria-current={key === slug ? 'page' : undefined}>{label}</a>
              ))}
            </nav>
          </footer>
        </div>
      </div>
    </HubLayout>
  );
}

export type { PolicySlug };
