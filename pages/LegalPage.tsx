import { useEffect, useMemo } from 'react';
import { ShieldAlert } from 'lucide-react';
import HubLayout from '../src/components/HubLayout';
import { useSiteContent } from '../src/components/useSiteContent';
import { sanitizeRichHtml } from '../src/lib/html-sanitize';
import { splitLegalSections } from '../src/lib/legalSections';
import { isPolicySlug, type PolicySlug } from '../src/lib/siteContentModel';

/**
 * A policy page: privacy, terms, cookies, accessibility, disclaimer or contact.
 *
 * The text is stored in `site_pages` and edited in the admin portal, so a policy
 * update does not need a deploy. Until an editor marks a page as legally
 * reviewed, the page says so in a banner - the one thing a policy page must
 * never do is imply an approval nobody gave.
 */

/**
 * The published policies link to each other.
 *
 * The footer is one compact bar under a height budget, so it holds the four
 * destinations most visitors look for and nothing else. That left three real
 * documents — the accessibility statement, the disclaimer and the refund policy
 * — with no inbound link at all: present in the sitemap and reachable by nobody.
 * A policy page is exactly where someone reads one policy and looks for the
 * next, so the cross-links live here, in the same card the body already uses.
 */
const RELATED_POLICIES: Array<{ href: string; label: string }> = [
  { href: '/privacy', label: 'Privacy notice' },
  { href: '/terms', label: 'Terms of use' },
  { href: '/cookies', label: 'Cookies and storage' },
  { href: '/refunds', label: 'Refund policy' },
  { href: '/accessibility', label: 'Accessibility statement' },
  { href: '/disclaimer', label: 'Disclaimer' },
  { href: '/contact', label: 'Contact us' },
];

function formatDate(value: string | null): string {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
}

export default function LegalPage({ slug }: { slug: string }) {
  const { content, status } = useSiteContent();
  const page = isPolicySlug(slug) ? content.pages.find((entry) => entry.slug === slug) ?? null : null;

  useEffect(() => {
    document.title = page
      ? `${page.title} | EduReach Hub`
      : status === 'error'
        ? 'Policy unavailable | EduReach Hub'
        : status === 'loading'
          ? 'Loading policy… | EduReach Hub'
          : 'Page not found | EduReach Hub';
  }, [page, status]);

  const updated = formatDate(page?.updatedAt ?? null);
  // The stored policy body is split into its major sections so the page uses the
  // same card containers as the rest of EduReach. Each section's HTML is
  // sanitised at render time - the split happens before sanitising, so the
  // heading match can only ever produce plain text.
  const sections = useMemo(() => (page ? splitLegalSections(page.body) : []), [page]);

  return (
    <HubLayout>
      <div className="er-legal-page">
        <div className="hub-container er-legal-container">
          {!page && status === 'live' && (
            <div className="er-legal-missing">
              <h1>This page is not published</h1>
              <p>
                The page you followed is not available right now. It may be under revision. Go back to the{' '}
                <a href="/">home page</a> or <a href="/contact">contact us</a> if you need this information today.
              </p>
            </div>
          )}

          {!page && status === 'loading' && (
            <div className="er-legal-missing" role="status">
              <h1>Loading this page…</h1>
              <p>If it does not appear, check your connection and reload.</p>
            </div>
          )}

          {/* The request finished without a payload. Saying "loading" here would
              be a spinner that never stops, so the page says what happened and
              gives a way to reach a person. */}
          {!page && status === 'error' && (
            <div className="er-legal-missing" role="alert">
              <h1>This page could not be loaded</h1>
              <p>
                EduReach could not reach the server just now, so the policy text is not available. Nothing you have
                saved is affected. <button type="button" className="er-legal-retry" onClick={() => window.location.reload()}>Reload the page</button>{' '}
                or <a href="/contact">contact us</a> and we will send you the policy directly.
              </p>
            </div>
          )}

          {page && (
            <article className="er-legal-article" aria-labelledby="legal-title">
              {page.reviewState !== 'approved' && (
                <div className="er-legal-draft" role="note">
                  <ShieldAlert size={18} aria-hidden="true" />
                  <p>
                    <strong>Draft pending legal review.</strong> This content may contain unverified claims and has not yet been reviewed by a lawyer.
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

              {slug === 'privacy' && (
                <aside className="er-legal-draft" role="note" aria-label="Privacy information requiring review">
                  <p>Account-wide self-service deletion and data export are not currently available in settings. Retention and age claims in this notice require operator verification and legal review.</p>
                </aside>
              )}

              {sections.map((section) =>
                section.heading ? (
                  <section className="er-legal-card" key={section.id} aria-labelledby={`legal-${section.id}`}>
                    <h2 id={`legal-${section.id}`}>{section.heading}</h2>
                    <div
                      className="er-legal-body"
                      /* Stored HTML is sanitised on render: the editor is staff,
                         but the renderer is what every visitor's browser trusts. */
                      dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(section.html) }}
                    />
                  </section>
                ) : (
                  <div className="er-legal-intro" key={section.id}>
                    <div
                      className="er-legal-body"
                      dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(section.html) }}
                    />
                  </div>
                ),
              )}

              <nav aria-labelledby="legal-related-policies">
                <section className="er-legal-card">
                  <h2 id="legal-related-policies">Other policies</h2>
                  <div className="er-legal-body">
                    <p>
                      {RELATED_POLICIES.filter((entry) => entry.href !== `/${slug}`).map((entry, index, all) => (
                        <span key={entry.href}>
                          <a href={entry.href}>{entry.label}</a>
                          {index < all.length - 1 ? ' · ' : ''}
                        </span>
                      ))}
                    </p>
                  </div>
                </section>
              </nav>
            </article>
          )}
        </div>
      </div>
    </HubLayout>
  );
}

export type { PolicySlug };
