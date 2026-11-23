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
import { AdminPageReport } from '../src/components/admin/AdminKit';
import { resetSiteContentCache } from '../src/lib/siteContent';
import {
  POLICY_SLUGS,
  SOCIAL_PLATFORMS,
  isSafeHttpsUrl,
  mergeSiteSettings,
  type SocialLink,
} from '../src/lib/siteContentModel';
import Tabs from '../src/components/ui/Tabs';

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

interface SettingsDraft {
  brand: { name: string; tagline: string };
  footer: { about: string };
  contact: {
    whatsapp: string;
    email: string;
    supportEmail: string;
    phone: string;
    note: string;
    details: Array<{ label: string; value: string }>;
  };
  social: { links: SocialLink[] };
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

/** A draft is compared to the last saved copy, never to "empty". */
function cloneDraft(draft: SettingsDraft): SettingsDraft {
  return JSON.parse(JSON.stringify(draft)) as SettingsDraft;
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Settings-system rule: every value the admin has changed carries a visible
 * "Modified" marker and its own way back, so reverting one group never means
 * rebuilding the other three from memory.
 */
function SettingChanges({ dirty, noun, onReset }: { dirty: boolean; noun: string; onReset: () => void }) {
  if (!dirty) return null;
  return (
    <span className="admin-setting-changes">
      <span className="admin-pill is-warn">Modified</span>
      <button type="button" className="admin-btn secondary" onClick={onReset}>
        Reset {noun}
      </button>
    </span>
  );
}

export default function AdminSitePage() {
  const [tab, setTab] = useState<Tab>('settings');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pages, setPages] = useState<AdminSitePage[]>([]);
  const [settings, setSettings] = useState<SettingsDraft>(() => toSettingsDraft(null));
  // The last saved copy, so "Modified" and "Reset" compare against the server
  // rather than against whatever the form happened to open with.
  const [savedSettings, setSavedSettings] = useState<SettingsDraft>(() => toSettingsDraft(null));
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
      const nextSettings = toSettingsDraft(body.settings);
      setSettings(nextSettings);
      setSavedSettings(cloneDraft(nextSettings));
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
      const saved = cloneDraft(settings);
      setSavedSettings(saved);
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

  const dirtySocial = settings.social.links.some((link) => {
    if (!link.label.trim()) return true;
    return Boolean(link.url.trim()) && !isSafeHttpsUrl(link.url);
  });
  const modified: Record<SettingsKey, boolean> = {
    brand: !sameValue(settings.brand, savedSettings.brand),
    footer: !sameValue(settings.footer, savedSettings.footer),
    contact: !sameValue(settings.contact, savedSettings.contact),
    social: !sameValue(settings.social, savedSettings.social),
  };

  function resetGroup(key: SettingsKey) {
    const original = cloneDraft(savedSettings)[key];
    setSettings((current) => ({ ...current, [key]: original }) as SettingsDraft);
    setNotice('Reverted to the last saved version. Nothing was written.');
    setError('');
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>Site, social &amp; contact</h1>
          <p>
            The footer and contact details, the social profiles behind each icon, and the policy pages a student can
            open without signing in.
          </p>
        </div>
      </div>

      <AdminPageReport
        title="Policy reporting"
        items={[
          { label: 'Policy pages', value: pages.length.toLocaleString() },
          { label: 'Published', value: pages.filter((page) => page.status === 'published').length.toLocaleString() },
          { label: 'Review pending', value: pages.filter((page) => page.reviewState !== 'approved').length.toLocaleString() },
          { label: 'Legal approved', value: pages.filter((page) => page.reviewState === 'approved').length.toLocaleString() },
        ]}
      />

      {error && <div className="admin-alert is-error" role="alert">{error}</div>}
      {notice && <div className="admin-alert is-success" role="status">{notice}</div>}
      {loading && <div className="admin-card"><p className="admin-footnote">Loading site content…</p></div>}

      {!loading && (
        <Tabs
          label="Site content sections"
          idPrefix="admin-site"
          value={tab}
          onChange={(id) => setTab(id as Tab)}
          items={[
            {
              id: 'settings',
              label: 'Branding & footer',
              panel: (
                <>
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
                    </button>
                    <SettingChanges dirty={modified.brand} noun="identity" onReset={() => resetGroup('brand')} />{' '}
                    <button type="button" className="admin-btn secondary" onClick={() => void saveSettings('footer')} disabled={savingSettings === 'footer'}>
                      {savingSettings === 'footer' ? 'Saving…' : 'Save footer sentence'}
                    </button>
                    <SettingChanges dirty={modified.footer} noun="footer sentence" onReset={() => resetGroup('footer')} />
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
                      <span>General contact email (optional)</span>
                      <input className="admin-input" type="email" value={settings.contact.email}
                        onChange={(event) => setSettings({ ...settings, contact: { ...settings.contact, email: event.target.value } })} />
                    </label>
                    <label className="admin-field">
                      <span>Official support email (optional)</span>
                      <input className="admin-input" type="email" value={settings.contact.supportEmail}
                        onChange={(event) => setSettings({ ...settings, contact: { ...settings.contact, supportEmail: event.target.value } })} />
                    </label>
                    <label className="admin-field">
                      <span>Support phone (optional)</span>
                      <input className="admin-input" type="tel" value={settings.contact.phone} maxLength={24}
                        onChange={(event) => setSettings({ ...settings, contact: { ...settings.contact, phone: event.target.value } })} />
                    </label>
                    <div className="admin-field">
                      <span>Other contact details (optional)</span>
                      {settings.contact.details.map((detail, index) => (
                        <div className="admin-field-row" key={index}>
                          <input className="admin-input" value={detail.label} maxLength={40} placeholder="Label, e.g. Office hours"
                            aria-label={`Contact detail ${index + 1} label`}
                            onChange={(event) => {
                              const details = settings.contact.details.map((entry, i) => (i === index ? { ...entry, label: event.target.value } : entry));
                              setSettings({ ...settings, contact: { ...settings.contact, details } });
                            }} />
                          <input className="admin-input" value={detail.value} maxLength={120} placeholder="Value"
                            aria-label={`Contact detail ${index + 1} value`}
                            onChange={(event) => {
                              const details = settings.contact.details.map((entry, i) => (i === index ? { ...entry, value: event.target.value } : entry));
                              setSettings({ ...settings, contact: { ...settings.contact, details } });
                            }} />
                          <button type="button" className="admin-btn secondary" aria-label={`Remove contact detail ${index + 1}`}
                            onClick={() => {
                              const details = settings.contact.details.filter((_, i) => i !== index);
                              setSettings({ ...settings, contact: { ...settings.contact, details } });
                            }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      <button type="button" className="admin-btn secondary" disabled={settings.contact.details.length >= 8}
                        onClick={() => setSettings({ ...settings, contact: { ...settings.contact, details: [...settings.contact.details, { label: '', value: '' }] } })}>
                        <Plus size={14} /> Add detail
                      </button>
                    </div>
                    <label className="admin-field">
                      <span>Note under the contact links</span>
                      <textarea className="admin-input" rows={2} maxLength={300} value={settings.contact.note}
                        onChange={(event) => setSettings({ ...settings, contact: { ...settings.contact, note: event.target.value } })} />
                    </label>
                    <button type="button" className="admin-btn" onClick={() => void saveSettings('contact')} disabled={savingSettings === 'contact'}>
                      <Save size={14} /> {savingSettings === 'contact' ? 'Saving…' : 'Save contact details'}
                    </button>
                    <SettingChanges dirty={modified.contact} noun="contact details" onReset={() => resetGroup('contact')} />
                  </section>

                  <section className="admin-card">
                    <div className="admin-card-header"><h2>Social accounts</h2></div>
                    <p className="admin-footnote">
                      A saved https:// address is the only thing that becomes a link. An enabled platform with no URL
                      shows its icon without a link, so the footer never points at an invented profile.
                    </p>
                    {settings.social.links.map((link, index) => {
                      const platform = SOCIAL_PLATFORMS.find((entry) => entry.key === link.platform);
                      return (
                        <div className="admin-social-editor" key={`${link.platform}-${index}`}>
                          <div className="admin-field-row">
                            <label className="admin-field">
                              <span>Platform</span>
                              <select className="admin-select" value={link.platform}
                                onChange={(event) => {
                                  const key = event.target.value as SocialLink['platform'];
                                  const chosen = SOCIAL_PLATFORMS.find((entry) => entry.key === key);
                                  const links = settings.social.links.map((entry, i) => (i === index
                                    ? { ...entry, platform: key, label: key === 'custom' ? entry.label : chosen?.label || entry.label }
                                    : entry));
                                  setSettings({ ...settings, social: { links } });
                                }}>
                                {SOCIAL_PLATFORMS.map((entry) => (
                                  <option key={entry.key} value={entry.key}>{entry.label}</option>
                                ))}
                              </select>
                            </label>
                            <label className="admin-field">
                              <span>{link.platform === 'custom' ? 'Platform name' : 'Display name'}</span>
                              <input className="admin-input" value={link.label} maxLength={40}
                                onChange={(event) => {
                                  const links = settings.social.links.map((entry, i) => (i === index ? { ...entry, label: event.target.value } : entry));
                                  setSettings({ ...settings, social: { links } });
                                } } />
                            </label>
                          </div>
                          <div className="admin-field-row">
                            <label className="admin-field">
                              <span>Profile URL (optional until the account exists)</span>
                              <input className="admin-input" type="url" inputMode="url" placeholder="https://"
                                value={link.url}
                                onChange={(event) => {
                                  const links = settings.social.links.map((entry, i) => (i === index ? { ...entry, url: event.target.value } : entry));
                                  setSettings({ ...settings, social: { links } });
                                } } />
                            </label>
                            <label className="admin-field">
                              <span>Handle (optional, without @)</span>
                              <input className="admin-input" value={link.handle} maxLength={40}
                                onChange={(event) => {
                                  const links = settings.social.links.map((entry, i) => (i === index ? { ...entry, handle: event.target.value } : entry));
                                  setSettings({ ...settings, social: { links } });
                                } } />
                            </label>
                          </div>
                          <div className="admin-social-editor-foot">
                            <label className="admin-check-row">
                              <input type="checkbox" checked={link.visible}
                                onChange={(event) => {
                                  const links = settings.social.links.map((entry, i) => (i === index ? { ...entry, visible: event.target.checked } : entry));
                                  setSettings({ ...settings, social: { links } });
                                } } />
                              Show this platform
                            </label>
                            <span className={`admin-pill ${link.url.trim() ? 'is-ok' : 'is-warn'}`}>
                              {link.url.trim() ? 'Configured' : 'No profile URL yet'}
                            </span>
                            <button type="button" className="admin-btn secondary" aria-label={`Remove ${platform?.label || link.label}`}
                              onClick={() => setSettings({ ...settings, social: { links: settings.social.links.filter((_, i) => i !== index) } })}>
                              <Trash2 size={14} /> Remove
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    <button type="button" className="admin-btn secondary" disabled={settings.social.links.length >= 16}
                      onClick={() => {
                        const used = new Set(settings.social.links.map((entry) => entry.platform));
                        const missing = SOCIAL_PLATFORMS.find((entry) => entry.key !== 'custom' && !used.has(entry.key));
                        const platform = missing?.key || 'custom';
                        setSettings({
                          ...settings,
                          social: {
                            links: [...settings.social.links, {
                              platform,
                              label: missing?.label || '',
                              handle: '',
                              url: '',
                              visible: true,
                            }],
                          },
                        });
                      }}>
                      <Plus size={14} /> Add platform
                    </button>
                    <button type="button" className="admin-btn" onClick={() => void saveSettings('social')} disabled={savingSettings === 'social' || dirtySocial}>
                      <Save size={14} /> {savingSettings === 'social' ? 'Saving…' : 'Save social links'}
                    </button>
                    <SettingChanges dirty={modified.social} noun="social links" onReset={() => resetGroup('social')} />
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
                </>
              ),
            },
            {
              id: 'pages',
              label: 'Policy pages',
              panel: (
                <>
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
                        <div className="admin-alert is-info" role="note">
                          <AlertTriangle size={14} /> Marking a page &quot;Approved&quot; is a statement that a lawyer has reviewed it. The
                  public page shows a draft banner until you do. <Check size={12} />
                </div>
                </>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
