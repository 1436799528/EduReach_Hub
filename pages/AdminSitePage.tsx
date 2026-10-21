import { userFacingError } from '../lib/errors';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Clock3, History, Plus, Save, Trash2 } from 'lucide-react';
import {
  fetchAdminSiteContent,
  fetchAdminSiteRevisions,
  restoreAdminSiteRevision,
  saveAdminSitePage,
  saveAdminSiteSettings,
  type AdminSitePage,
  type AdminSiteRevision,
} from '../src/lib/api';
import { useSiteContent } from '../src/components/useSiteContent';
import { resetSiteContentCache } from '../src/lib/siteContent';
import { POLICY_SLUGS, isSafeHttpsUrl, mergeSiteSettings } from '../src/lib/siteContentModel';

/**
 * Site & policies: the admin portal's source of truth for everything the public
 * footer and the policy pages say.
 *
 * Two panels, because they are edited differently:
 *  - Branding & footer: small structured fields. Saving validates the URL
 *    fields server-side; an invalid social URL is refused, not stored and
 *    quietly dropped at render.
 *  - Policy pages: long text with a draft/published state and a separate
 *    legal-review state. Every save creates a revision, and any revision can be
 *    restored as a new one - history is never rewritten.
 */

type Tab = 'settings' | 'pages';
type SettingsKey = 'brand' | 'footer' | 'contact' | 'social';

interface SocialDraft { label: string; url: string }

interface SettingsDraft {
  brand: { name: string; tagline: string };
  footer: { about: string };
  contact: { whatsapp: string; email: string; note: string };
  social: { links: SocialDraft[] };
}

interface PageDraft {
  title: string;
  summary: string;
  body: string;
  status: 'draft' | 'published';
  reviewState: 'pending' | 'approved';
}

function toSettingsDraft(raw: unknown): SettingsDraft {
  const merged = mergeSiteSettings(raw);
  return {
    brand: { name: merged.brand.name, tagline: merged.brand.tagline },
    footer: { about: merged.footer.about },
    contact: { ...merged.contact },
    social: { links: merged.social.links.map((link) => ({ ...link })) },
  };
}

function toPageDraft(page: AdminSitePage | null): PageDraft {
  return {
    title: page?.title ?? '',
    summary: page?.summary ?? '',
    body: page?.body ?? '',
    status: page?.status ?? 'draft',
    reviewState: page?.reviewState ?? 'pending',
  };
}

function formatWhen(value: string | null): string {
  if (!value) return 'never';
  try {
    return new Date(value).toLocaleString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return value;
  }
}

export default function AdminSitePage() {
  const [tab, setTab] = useState<Tab>('settings');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pages, setPages] = useState<AdminSitePage[]>([]);
  const [settings, setSettings] = useState<SettingsDraft>(() => toSettingsDraft(null));
  const [savingSettings, setSavingSettings] = useState<SettingsKey | ''>('');
  const [activeSlug, setActiveSlug] = useState<string>(POLICY_SLUGS[0]);
  const [draft, setDraft] = useState<PageDraft>(() => toPageDraft(null));
  const [savingPage, setSavingPage] = useState(false);
  const [revisions, setRevisions] = useState<AdminSiteRevision[] | null>(null);
  const [revisionError, setRevisionError] = useState('');
  const [restoring, setRestoring] = useState(0);
  const { content: publicContent } = useSiteContent();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const body = await fetchAdminSiteContent();
      const sorted = [...(body.pages || [])].sort((a, b) => POLICY_SLUGS.indexOf(a.slug as never) - POLICY_SLUGS.indexOf(b.slug as never));
      setPages(sorted);
      setSettings(toSettingsDraft(body.settings));
      const first = sorted.find((page) => page.slug === activeSlug) ?? sorted[0] ?? null;
      if (first) {
        setActiveSlug(first.slug);
        setDraft(toPageDraft(first));
      }
    } catch (value) {
      setError(userFacingError(value, 'Unable to load site content.'));
    } finally {
      setLoading(false);
    }
    // activeSlug is read once on load; changing tabs must not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { void load(); }, [load]);

  const activePage = useMemo(() => pages.find((page) => page.slug === activeSlug) ?? null, [pages, activeSlug]);

  useEffect(() => {
    setDraft(toPageDraft(activePage));
    setRevisions(null);
    setRevisionError('');
  }, [activePage]);

  async function saveSettings(key: SettingsKey) {
    setSavingSettings(key);
    setNotice('');
    setError('');
    try {
      const value = key === 'social' ? settings.social : settings[key];
      await saveAdminSiteSettings(key, value as unknown as Record<string, unknown>);
      setNotice(key === 'social' ? 'Social links saved.' : `${key[0].toUpperCase()}${key.slice(1)} saved.`);
      // The footer on this tab reads the cached copy; drop it so the next render
      // shows what was just saved.
      resetSiteContentCache();
    } catch (value) {
      setError(userFacingError(value, 'That setting could not be saved.'));
    } finally {
      setSavingSettings('');
    }
  }

  async function savePage() {
    if (!activePage) return;
    setSavingPage(true);
    setNotice('');
    setError('');
    try {
      const saved = await saveAdminSitePage(activePage.slug, draft);
      setPages((current) => current.map((page) => (page.slug === saved.slug ? saved : page)));
      setDraft(toPageDraft(saved));
      setNotice(`Saved ${saved.slug} as version ${saved.revision} (${saved.status === 'published' ? 'published' : 'draft'}).`);
      setRevisions(null);
      resetSiteContentCache();
    } catch (value) {
      setError(userFacingError(value, 'That page could not be saved.'));
    } finally {
      setSavingPage(false);
    }
  }

  async function loadRevisions() {
    if (!activePage) return;
    setRevisionError('');
    try {
      setRevisions(await fetchAdminSiteRevisions(activePage.slug));
    } catch (value) {
      setRevisionError(userFacingError(value, 'Unable to load the revision history.'));
    }
  }

  async function restore(revision: number) {
    if (!activePage) return;
    setRestoring(revision);
    setNotice('');
    setError('');
    try {
      const saved = await restoreAdminSiteRevision(activePage.slug, revision);
      setPages((current) => current.map((page) => (page.slug === saved.slug ? saved : page)));
      setDraft(toPageDraft(saved));
      setNotice(`Restored version ${revision} as version ${saved.revision}. Nothing was overwritten.`);
      setRevisions(null);
      resetSiteContentCache();
    } catch (value) {
      setError(userFacingError(value, 'That revision could not be restored.'));
    } finally {
      setRestoring(0);
    }
  }

  const dirtySocial = settings.social.links.some((link) => link.label.trim() && !isSafeHttpsUrl(link.url));

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>Site &amp; policies</h1>
          <p>What every visitor reads in the footer, and the policy pages a student can open without signing in.</p>
        </div>
      </div>

      <div className="admin-tabs" role="tablist" aria-label="Site content sections">
        <button type="button" role="tab" aria-selected={tab === 'settings'} className={`admin-tab${tab === 'settings' ? ' is-active' : ''}`} onClick={() => setTab('settings')}>
          Branding &amp; footer
        </button>
        <button type="button" role="tab" aria-selected={tab === 'pages'} className={`admin-tab${tab === 'pages' ? ' is-active' : ''}`} onClick={() => setTab('pages')}>
          Policy pages
        </button>
      </div>

      {error && <div className="admin-alert is-error" role="alert">{error}</div>}
      {notice && <div className="admin-alert is-success" role="status">{notice}</div>}
      {loading && <div className="admin-card"><p className="admin-footnote">Loading site content…</p></div>}

      {!loading && tab === 'settings' && (
        <div className="admin-grid-two">
          <section className="admin-card">
            <div className="admin-card-header"><h2>Identity</h2></div>
            <label className="admin-field">
              <span>Site name</span>
              <input className="admin-input" value={settings.brand.name} maxLength={60}
                onChange={(event) => setSettings({ ...settings, brand: { ...settings.brand, name: event.target.value } })} />
            </label>
            <label className="admin-field">
              <span>One-line description</span>
              <input className="admin-input" value={settings.brand.tagline} maxLength={160}
                onChange={(event) => setSettings({ ...settings, brand: { ...settings.brand, tagline: event.target.value } })} />
            </label>
            <label className="admin-field">
              <span>Footer sentence</span>
              <textarea className="admin-input" rows={3} maxLength={400} value={settings.footer.about}
                onChange={(event) => setSettings({ ...settings, footer: { about: event.target.value } })} />
            </label>
            <button type="button" className="admin-btn" onClick={() => void saveSettings('brand')} disabled={savingSettings === 'brand'}>
              <Save size={14} /> {savingSettings === 'brand' ? 'Saving…' : 'Save identity'}
            </button>{' '}
            <button type="button" className="admin-btn secondary" onClick={() => void saveSettings('footer')} disabled={savingSettings === 'footer'}>
              {savingSettings === 'footer' ? 'Saving…' : 'Save footer sentence'}
            </button>
          </section>

          <section className="admin-card">
            <div className="admin-card-header"><h2>Contact</h2></div>
            <p className="admin-footnote">These details are shown on the contact page and in the footer. Leave email empty if there is no mailbox yet — an address that does not exist is worse than none.</p>
            <label className="admin-field">
              <span>WhatsApp number (international, digits only)</span>
              <input className="admin-input" inputMode="numeric" value={settings.contact.whatsapp} maxLength={15}
                onChange={(event) => setSettings({ ...settings, contact: { ...settings.contact, whatsapp: event.target.value } })} />
            </label>
            <label className="admin-field">
              <span>Email (optional)</span>
              <input className="admin-input" type="email" value={settings.contact.email}
                onChange={(event) => setSettings({ ...settings, contact: { ...settings.contact, email: event.target.value } })} />
            </label>
            <label className="admin-field">
              <span>Note under the contact links</span>
              <textarea className="admin-input" rows={2} maxLength={300} value={settings.contact.note}
                onChange={(event) => setSettings({ ...settings, contact: { ...settings.contact, note: event.target.value } })} />
            </label>
            <button type="button" className="admin-btn" onClick={() => void saveSettings('contact')} disabled={savingSettings === 'contact'}>
              <Save size={14} /> {savingSettings === 'contact' ? 'Saving…' : 'Save contact details'}
            </button>
          </section>

          <section className="admin-card">
            <div className="admin-card-header"><h2>Social accounts</h2></div>
            <p className="admin-footnote">Only accounts that exist. A blank list renders no social links at all; a link without a valid https:// address is refused by the server.</p>
            {settings.social.links.length === 0 && <p className="admin-footnote">No social accounts configured.</p>}
            {settings.social.links.map((link, index) => (
              <div className="admin-field-row" key={index}>
                <label className="admin-field">
                  <span>Label</span>
                  <input className="admin-input" value={link.label} maxLength={40}
                    onChange={(event) => {
                      const links = settings.social.links.map((entry, i) => (i === index ? { ...entry, label: event.target.value } : entry));
                      setSettings({ ...settings, social: { links } });
                    }} />
                </label>
                <label className="admin-field">
                  <span>https:// address</span>
                  <input className="admin-input" type="url" value={link.url}
                    onChange={(event) => {
                      const links = settings.social.links.map((entry, i) => (i === index ? { ...entry, url: event.target.value } : entry));
                      setSettings({ ...settings, social: { links } });
                    }} />
                </label>
                <button type="button" className="admin-btn secondary" aria-label={`Remove ${link.label || 'link'}`}
                  onClick={() => setSettings({ ...settings, social: { links: settings.social.links.filter((_, i) => i !== index) } })}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button type="button" className="admin-btn secondary" disabled={settings.social.links.length >= 8}
              onClick={() => setSettings({ ...settings, social: { links: [...settings.social.links, { label: '', url: '' }] } })}>
              <Plus size={14} /> Add link
            </button>{' '}
            <button type="button" className="admin-btn" onClick={() => void saveSettings('social')} disabled={savingSettings === 'social' || dirtySocial}>
              <Save size={14} /> {savingSettings === 'social' ? 'Saving…' : 'Save social links'}
            </button>
            {dirtySocial && <p className="admin-footnote" role="alert">Every link needs a full https:// address before it can be saved.</p>}
          </section>

          <section className="admin-card">
            <div className="admin-card-header"><h2>What visitors see now</h2></div>
            <p className="admin-footnote">
              Source: {publicContent.settings.brand.name === settings.brand.name ? 'live site content' : 'saved copy'} — the footer reads the same data as this form.
            </p>
            <p><strong>{settings.brand.name}</strong></p>
            <p className="admin-footnote">{settings.footer.about}</p>
            {settings.contact.whatsapp && <p className="admin-footnote">WhatsApp: {settings.contact.whatsapp}</p>}
            {settings.contact.email && <p className="admin-footnote">Email: {settings.contact.email}</p>}
          </section>
        </div>
      )}

      {!loading && tab === 'pages' && (
        <div className="admin-grid-two">
          <section className="admin-card">
            <div className="admin-card-header"><h2>Pages</h2></div>
            <div className="admin-list">
              {pages.map((page) => (
                <button
                  key={page.slug}
                  type="button"
                  className={`admin-list-item${page.slug === activeSlug ? ' is-active' : ''}`}
                  onClick={() => setActiveSlug(page.slug)}
                >
                  <span>
                    <strong>/{page.slug}</strong>
                    <small>{page.title}</small>
                  </span>
                  <span className={`admin-pill ${page.status === 'published' ? 'is-ok' : 'is-muted'}`}>{page.status}</span>
                  <span className={`admin-pill ${page.reviewState === 'approved' ? 'is-ok' : 'is-warn'}`}>
                    {page.reviewState === 'approved' ? 'reviewed' : 'review pending'}
                  </span>
                </button>
              ))}
            </div>
            <p className="admin-footnote">A page is only reachable when it is published. The legal-review flag controls the banner on the public page, not visibility.</p>
          </section>

          <section className="admin-card">
            {!activePage && <p className="admin-footnote">Select a page.</p>}
            {activePage && (
              <>
                <div className="admin-card-header">
                  <h2>/{activePage.slug}</h2>
                  <span className="admin-footnote">
                    <Clock3 size={12} /> updated {formatWhen(activePage.updatedAt)} · version {activePage.revision}
                  </span>
                </div>
                <label className="admin-field">
                  <span>Title</span>
                  <input className="admin-input" value={draft.title} maxLength={120}
                    onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
                </label>
                <label className="admin-field">
                  <span>Summary (one sentence, shown under the title)</span>
                  <input className="admin-input" value={draft.summary} maxLength={300}
                    onChange={(event) => setDraft({ ...draft, summary: event.target.value })} />
                </label>
                <label className="admin-field">
                  <span>Body (HTML: paragraphs, lists, links, headings)</span>
                  <textarea className="admin-input admin-textarea-lg" rows={18} value={draft.body}
                    onChange={(event) => setDraft({ ...draft, body: event.target.value })} />
                </label>
                <div className="admin-field-row">
                  <label className="admin-field">
                    <span>Visibility</span>
                    <select className="admin-input" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as PageDraft['status'] })}>
                      <option value="draft">Draft (not public)</option>
                      <option value="published">Published</option>
                    </select>
                  </label>
                  <label className="admin-field">
                    <span>Legal review</span>
                    <select className="admin-input" value={draft.reviewState} onChange={(event) => setDraft({ ...draft, reviewState: event.target.value as PageDraft['reviewState'] })}>
                      <option value="pending">Pending (banner shown)</option>
                      <option value="approved">Approved (banner removed)</option>
                    </select>
                  </label>
                </div>
                <button type="button" className="admin-btn" onClick={() => void savePage()} disabled={savingPage}>
                  <Save size={14} /> {savingPage ? 'Saving…' : 'Save page'}
                </button>{' '}
                <a className="admin-btn secondary" href={`/${activePage.slug}`} target="_blank" rel="noopener noreferrer">
                  View public page
                </a>

                <div className="admin-card-header" style={{ marginTop: 24 }}>
                  <h2><History size={15} /> Revision history</h2>
                  {revisions === null && <button type="button" className="admin-btn secondary" onClick={() => void loadRevisions()}>Show history</button>}
                </div>
                {revisionError && <div className="admin-alert is-error" role="alert">{revisionError}</div>}
                {revisions !== null && revisions.length === 0 && <p className="admin-footnote">No saved versions yet.</p>}
                {revisions !== null && revisions.length > 0 && (
                  <div className="admin-list">
                    {revisions.map((revision) => (
                      <div className="admin-list-item" key={revision.id}>
                        <span>
                          <strong>Version {revision.revision}</strong>
                          <small>{formatWhen(revision.editedAt)} · {revision.status} · review {revision.reviewState}</small>
                        </span>
                        <button type="button" className="admin-btn secondary" disabled={restoring > 0}
                          onClick={() => void restore(revision.revision)}>
                          {restoring === revision.revision ? 'Restoring…' : 'Restore'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}

      {!loading && tab === 'pages' && (
        <div className="admin-alert is-info" role="note">
          <AlertTriangle size={14} /> Marking a page &quot;Approved&quot; is a statement that a lawyer has reviewed it. The
          public page shows a draft banner until you do. <Check size={12} />
        </div>
      )}
    </div>
  );
}
