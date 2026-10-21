import { userFacingError } from '../lib/errors';
import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, BookOpen, Eye, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  adminApiFetch,
  createAdminService,
  deleteAdminService,
  fetchAdminServices,
  updateAdminService,
  uploadAdminImage,
  type AdminService,
} from '../src/lib/api';
import type { ServiceGuide, ServiceGuideStep } from '../src/data/serviceGuides';

// Admin guide API (kept in this lazy admin chunk so the shared API module —
// and therefore the student first-load bundle — does not grow).
type AdminServiceGuide = ServiceGuide & { status: 'draft' | 'published'; updatedAt?: string };
const fetchAdminServiceGuide = (serviceId: string) => adminApiFetch<{ guide: AdminServiceGuide | null; serviceKey: string }>(`/api/admin/services/${encodeURIComponent(serviceId)}/guide`);
const saveAdminServiceGuide = async (serviceId: string, guide: AdminServiceGuide): Promise<AdminServiceGuide> => (await adminApiFetch<{ guide: AdminServiceGuide }>(`/api/admin/services/${encodeURIComponent(serviceId)}/guide`, { method: 'PUT', body: JSON.stringify(guide) })).guide;
const resetAdminServiceGuide = (serviceId: string) => adminApiFetch(`/api/admin/services/${encodeURIComponent(serviceId)}/guide`, { method: 'DELETE' });
import { AdminEmptyState, StatusBadge } from '../src/components/admin/AdminKit';

// Service Catalogue manager: full CRUD over the service_catalog rows the
// public /services page renders. The four built-in application-form services
// are editable and deactivate-able but cannot be deleted (their forms ship
// with the code release); every other row is fully managed here.

type EditState = {
  id: string | null;
  service_key: string;
  title: string;
  description: string;
  application_url: string;
  route: string;
  category: string;
  sort_order: string;
  active: boolean;
  is_form_service: boolean;
};

const emptyEdit: EditState = { id: null, service_key: '', title: '', description: '', application_url: '', route: '', category: 'Services', sort_order: '100', active: true, is_form_service: false };


// Step-by-step guide editor for one catalogue service. Guides saved here are
// stored server-side and override the built-in guide from
// src/data/serviceGuides.ts once published; drafts never reach students.
// Resetting deletes the saved guide and restores the built-in default —
// catalogue routes and WhatsApp destinations are never touched by guide edits.
const GUIDE_KIND_OPTIONS: Array<{ value: ServiceGuideStep['imageKind']; label: string }> = [
  { value: 'screenshot', label: 'Portal screenshot' },
  { value: 'official-document', label: 'Official document / notice' },
  { value: 'illustration', label: 'Illustration' },
  { value: 'photo', label: 'Photo' },
  { value: 'placeholder', label: 'Placeholder — screenshot pending' },
];
const blankStep = (): ServiceGuideStep => ({ title: '', body: '', image: '', imageAlt: '', imageKind: 'placeholder', imageSource: 'Placeholder — official screenshot pending verification' });
const builtinGuide = async (key: string): Promise<AdminServiceGuide> => {
  const { guideForService } = await import('../src/data/serviceGuides');
  const builtin = guideForService(key);
  return builtin ? { ...builtin, status: 'draft', steps: builtin.steps.map((step) => ({ ...step })) } : { slug: key, eyebrow: '', summary: '', safetyNote: '', status: 'draft', steps: [blankStep()] };
};

function GuideEditor({ service, onClose, onNotice }: { service: AdminService; onClose: () => void; onNotice: (text: string) => void }) {
  const [guide, setGuide] = useState<AdminServiceGuide | null>(null);
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [uploadingStep, setUploadingStep] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { guide: stored } = await fetchAdminServiceGuide(service.id);
        if (!active) return;
        if (stored) { setGuide(stored); setIsCustom(true); } else setGuide(await builtinGuide(service.service_key));
      } catch (e) { if (active) setError(userFacingError(e, 'Unable to load the guide editor.')); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [service.id, service.service_key]);

  const patchStep = (index: number, patch: Partial<ServiceGuideStep>) => setGuide((c) => c ? { ...c, steps: c.steps.map((step, i) => i === index ? { ...step, ...patch } : step) } : c);
  const moveStep = (index: number, direction: -1 | 1) => setGuide((c) => {
    if (!c) return c;
    const target = index + direction;
    if (target < 0 || target >= c.steps.length) return c;
    const steps = [...c.steps];
    [steps[index], steps[target]] = [steps[target], steps[index]];
    return { ...c, steps };
  });
  async function uploadStepImage(index: number, file: File) {
    if (file.size > 2 * 1024 * 1024) { setError('Images must be 2 MB or smaller.'); return; }
    setUploadingStep(index); setError('');
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Could not read the image file.'));
        reader.readAsDataURL(file);
      });
      patchStep(index, { image: (await uploadAdminImage(dataUrl)).url });
    } catch (e) { setError(userFacingError(e, 'Image upload failed.')); }
    finally { setUploadingStep(null); }
  }
  async function save() {
    if (!guide) return;
    setSaving(true); setError('');
    try {
      const saved = await saveAdminServiceGuide(service.id, guide);
      setGuide(saved); setIsCustom(true);
      onNotice(saved.status === 'published' ? `Guide for “${service.title}” is published.` : `Guide for “${service.title}” saved as a draft.`);
    } catch (e) { setError(userFacingError(e, 'Unable to save the guide.')); }
    finally { setSaving(false); }
  }
  async function resetToBuiltin() {
    if (!window.confirm('Remove the saved guide and restore the built-in default?')) return;
    setSaving(true); setError('');
    try {
      await resetAdminServiceGuide(service.id);
      setGuide(await builtinGuide(service.service_key)); setIsCustom(false);
      onNotice(`Guide for “${service.title}” reset to the built-in default.`);
    } catch (e) { setError(userFacingError(e, 'Unable to reset the guide.')); }
    finally { setSaving(false); }
  }

  const field = (label: string, control: React.ReactNode) => (
    <label className="admin-field"><span>{label}</span>{control}</label>
  );
  return (
    <div className="admin-card">
      <div className="admin-card-header"><h2>Guide steps — {service.title}</h2><button type="button" className="admin-text-btn" onClick={onClose}>Close</button></div>
      <div className="admin-news-editor-body">
        {loading && <p className="muted">Loading guide…</p>}
        {error && <div role="alert"><span>{error}</span></div>}
        {!loading && guide && (<>
          <p className="admin-footnote">{isCustom ? 'Saved guide in use. Publishing replaces what students see; routes and WhatsApp links are unaffected.' : 'Showing the built-in guide. Saving creates an editable copy; publishing makes it live.'} Mark an image “Portal screenshot” only when it really shows the portal.</p>
          <div className="admin-news-form-grid">
            <div className="admin-field-row">
              {field('Eyebrow', <input aria-label="Eyebrow" className="admin-input" value={guide.eyebrow} onChange={(e) => setGuide({ ...guide, eyebrow: e.target.value })} placeholder="e.g. Result-checking guide" />)}
              {field('Publication state', <select aria-label="Publication state" className="admin-input" value={guide.status} onChange={(e) => setGuide({ ...guide, status: e.target.value as AdminServiceGuide['status'] })}><option value="draft">Draft — hidden from students</option><option value="published">Published — live for students</option></select>)}
            </div>
            {field('Summary', <textarea aria-label="Summary" className="admin-textarea" style={{ minHeight: 56 }} value={guide.summary} onChange={(e) => setGuide({ ...guide, summary: e.target.value })} />)}
            {field('Safety note', <textarea aria-label="Safety note" className="admin-textarea" style={{ minHeight: 48 }} value={guide.safetyNote} onChange={(e) => setGuide({ ...guide, safetyNote: e.target.value })} />)}
          </div>
          {guide.steps.map((step, index) => (
            <div key={index} className="admin-card" style={{ padding: '14px 16px' }}>
              <div className="admin-card-header">
                <h3 style={{ margin: 0, fontSize: 14 }}>Step {index + 1}</h3>
                <div className="admin-action-row">
                  <button type="button" className="admin-btn small" aria-label={`Move step ${index + 1} up`} disabled={index === 0} onClick={() => moveStep(index, -1)}><ArrowUp size={12} /></button>
                  <button type="button" className="admin-btn small" aria-label={`Move step ${index + 1} down`} disabled={index === guide.steps.length - 1} onClick={() => moveStep(index, 1)}><ArrowDown size={12} /></button>
                  <button type="button" className="admin-text-btn danger-text" aria-label={`Delete step ${index + 1}`} disabled={guide.steps.length <= 1} onClick={() => setGuide({ ...guide, steps: guide.steps.filter((_, i) => i !== index) })}><Trash2 size={12} /></button>
                </div>
              </div>
              <div className="admin-news-form-grid">
                <div className="admin-field-row">
                  {field('Section (optional)', <input aria-label="Section (optional)" className="admin-input" value={step.section || ''} onChange={(e) => patchStep(index, { section: e.target.value })} placeholder="e.g. NECO — results.neco.gov.ng" />)}
                  {field('Step title *', <input aria-label="Step title *" className="admin-input" value={step.title} onChange={(e) => patchStep(index, { title: e.target.value })} />)}
                </div>
                {field('Instructions *', <textarea aria-label="Instructions *" className="admin-textarea" style={{ minHeight: 64 }} value={step.body} onChange={(e) => patchStep(index, { body: e.target.value })} />)}
                <div className="admin-field-row">
                  {field('Image (site path or HTTPS link)', <input aria-label="Image (site path or HTTPS link)" className="admin-input" value={step.image} onChange={(e) => patchStep(index, { image: e.target.value })} placeholder="/images/service-guides/… or https://…" />)}
                  {field('Upload screenshot', <><input className="admin-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif" aria-label={`Upload image for step ${index + 1}`} onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadStepImage(index, file); e.target.value = ''; }} />{uploadingStep === index && <span className="muted">Uploading…</span>}</>)}
                </div>
                {step.image && <img src={step.image} alt="" loading="lazy" decoding="async" style={{ maxWidth: 320, width: '100%', borderRadius: 8, border: '1px solid #e2e8f0' }} />}
                <div className="admin-field-row">
                  {field('Image type', <select aria-label="Image type" className="admin-input" value={step.imageKind} onChange={(e) => patchStep(index, { imageKind: e.target.value as ServiceGuideStep['imageKind'] })}>{GUIDE_KIND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>)}
                  {field('Image source / credit', <input aria-label="Image source / credit" className="admin-input" value={step.imageSource} onChange={(e) => patchStep(index, { imageSource: e.target.value })} placeholder="e.g. Portal screenshot via myschool.ng (verified 2026-10-21)" />)}
                </div>
                {field('Alt text (describe the screen)', <input aria-label="Alt text (describe the screen)" className="admin-input" value={step.imageAlt} onChange={(e) => patchStep(index, { imageAlt: e.target.value })} />)}
              </div>
            </div>
          ))}
          <div className="admin-action-row">
            <button type="button" className="admin-btn" onClick={() => setGuide({ ...guide, steps: [...guide.steps, blankStep()] })} disabled={guide.steps.length >= 24}><Plus size={14} /> Add step</button>
            <button type="button" className="admin-btn" onClick={() => setShowPreview((v) => !v)}><Eye size={14} /> {showPreview ? 'Hide preview' : 'Preview'}</button>
            <a className="admin-btn" href={service.service_key === 'nelfund-loan' ? '/nelfund' : `/services/${service.service_key}`} target="_blank" rel="noopener noreferrer">Open live page</a>
          </div>
          {showPreview && (
            <div className="admin-card" style={{ padding: '14px 16px' }}>
              <h3 style={{ marginTop: 0, fontSize: 14 }}>Preview — {guide.status === 'published' ? 'as students see it' : 'draft (not visible to students)'}</h3>
              <p className="muted">{guide.summary}</p>
              {guide.steps.map((step, index) => (
                <div key={index} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12, padding: '10px 0', borderTop: '1px solid #eef2f5' }}>
                  {step.image ? <img src={step.image} alt={step.imageAlt} loading="lazy" decoding="async" style={{ width: 120, borderRadius: 8 }} /> : <span className="muted">No image</span>}
                  <div>{step.section && <div className="muted" style={{ fontSize: 11, fontWeight: 680 }}>{step.section}</div>}<b>{String(index + 1).padStart(2, '0')} {step.title}</b><p className="muted" style={{ margin: '4px 0' }}>{step.body}</p><span className="muted" style={{ fontSize: 11 }}>{step.imageKind} · {step.imageSource}</span></div>
                </div>
              ))}
              <p className="muted">{guide.safetyNote}</p>
            </div>
          )}
          <div className="admin-news-editor-actions">
            <button type="button" className="admin-btn success" onClick={() => void save()} disabled={saving} aria-busy={saving}>{saving ? 'Saving…' : guide.status === 'published' ? 'Save & publish' : 'Save draft'}</button>
            {isCustom && <button type="button" className="admin-text-btn danger-text" onClick={() => void resetToBuiltin()} disabled={saving}>Reset to built-in guide</button>}
          </div>
        </>)}
      </div>
    </div>
  );
}

export default function AdminServicesPage() {
  const [services, setServices] = useState<AdminService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [edit, setEdit] = useState<EditState | null>(null);
  const [guideService, setGuideService] = useState<AdminService | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setError('');
      setServices(await fetchAdminServices());
    } catch (e) {
      setServices([]);
      setError(userFacingError(e, 'Unable to load the service catalogue.'));
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function save() {
    if (!edit) return;
    if (!edit.title.trim()) { setError('The service title cannot be empty.'); return; }
    setSaving(true); setError('');
    try {
      const values = {
        title: edit.title.trim(),
        description: edit.description.trim() || null,
        application_url: edit.application_url.trim() || null,
        route: edit.route.trim() || null,
        category: edit.category.trim() || 'Services',
        sort_order: Number(edit.sort_order) || 100,
        active: edit.active,
      };
      if (edit.id) {
        const updated = await updateAdminService(edit.id, values);
        setServices((current) => current.map((service) => service.id === updated.id ? { ...updated, is_form_service: service.is_form_service } : service));
        setMessage('Service updated. The live catalogue reflects it on the next load.');
      } else {
        const created = await createAdminService({ ...values, service_key: edit.service_key.trim() || undefined });
        setServices((current) => [...current, { ...created, is_form_service: false }].sort((a, b) => (a.sort_order ?? 100) - (b.sort_order ?? 100)));
        setMessage('Service created. It is live on /services right away.');
      }
      setEdit(null);
    } catch (e) {
      setError(userFacingError(e, 'Unable to save the service.'));
    } finally { setSaving(false); }
  }

  async function toggleActive(service: AdminService) {
    try {
      const updated = await updateAdminService(service.id, { active: !service.active });
      setServices((current) => current.map((item) => item.id === updated.id ? { ...updated, is_form_service: service.is_form_service } : item));
      setMessage(updated.active ? `“${updated.title}” is visible to students.` : `“${updated.title}” is hidden from students.`);
    } catch (e) {
      setError(userFacingError(e, 'Unable to update the service.'));
    }
  }

  async function remove(service: AdminService) {
    const confirmation = window.prompt(`Type DELETE to permanently remove “${service.title}” from the catalogue. This action cannot be undone.`);
    if (confirmation !== 'DELETE') return;
    try {
      await deleteAdminService(service.id);
      setServices((current) => current.filter((item) => item.id !== service.id));
      setMessage('Service permanently deleted.');
    } catch (e) {
      setError(userFacingError(e, 'Unable to delete the service.'));
    }
  }

  return (
      <div className="admin-page">
        <div className="admin-page-header">
          <div>
            <h1>Service Catalogue</h1>
            <p>Everything students see on /services: application forms, in-app routes and external links, ordered, described and switched here.</p>
          </div>
          <div className="admin-header-actions">
            <button type="button" className="admin-btn secondary-dark" onClick={() => void load()} disabled={loading} aria-label="Refresh services"><RefreshCw size={14} /></button>
            <button type="button" className="admin-btn" onClick={() => setEdit({ ...emptyEdit })}><Plus size={14} /> New service</button>
          </div>
        </div>

        {error && <div className="admin-card" role="alert" style={{ padding: '14px 18px' }}><span>{error}</span></div>}
        {message && <div className="admin-card" style={{ padding: '14px 18px', borderLeft: '4px solid var(--admin-green)' }}><span>{message}</span></div>}

        {edit && (
          <div className="admin-card">
            <div className="admin-card-header">
              <h2>{edit.id ? 'Edit service' : 'New service'}</h2>
              <button type="button" className="admin-text-btn" onClick={() => setEdit(null)}>Close</button>
            </div>
            <div className="admin-news-editor-body">
              <div className="admin-news-form-grid">
                <div className="admin-field-row">
                  <label className="admin-field"><span>Title *</span>
                    <input className="admin-input" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="e.g. JAMB Services" />
                  </label>
                  {!edit.id && (
                    <label className="admin-field"><span>Key (optional)</span>
                      <input className="admin-input" value={edit.service_key} onChange={(e) => setEdit({ ...edit, service_key: e.target.value })} placeholder="auto from title" disabled={Boolean(edit.id && edit.is_form_service)} />
                    </label>
                  )}
                  <label className="admin-field"><span>Category</span>
                    <input className="admin-input" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} placeholder="Services / Examinations / Academics…" />
                  </label>
                  <label className="admin-field"><span>Sort order</span>
                    <input className="admin-input" type="number" value={edit.sort_order} onChange={(e) => setEdit({ ...edit, sort_order: e.target.value })} />
                  </label>
                </div>
                <label className="admin-field"><span>Description</span>
                  <textarea className="admin-textarea" style={{ minHeight: 64 }} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
                </label>
                <div className="admin-field-row">
                  <label className="admin-field"><span>In-app route</span>
                    <input className="admin-input" value={edit.route} onChange={(e) => setEdit({ ...edit, route: e.target.value })} placeholder="/schools" disabled={Boolean(edit.id && edit.is_form_service)} />
                  </label>
                  <label className="admin-field"><span>External link (https)</span>
                    <input className="admin-input" value={edit.application_url} onChange={(e) => setEdit({ ...edit, application_url: e.target.value })} placeholder="https://…" disabled={Boolean(edit.id && edit.is_form_service)} />
                  </label>
                  <label className="admin-field admin-field-check"><span>Visibility</span>
                    <span className="admin-check-row">
                      <input id="svc-active" type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />
                      <label htmlFor="svc-active">{edit.active ? 'Visible to students' : 'Hidden'}</label>
                    </span>
                  </label>
                </div>
                {edit.id && edit.is_form_service && <p className="admin-footnote">This is a built-in application-form service: its form ships with the code release, so its key/route/link are fixed. You can still edit the title, description, category, order and visibility.</p>}
              </div>
              <div className="admin-news-editor-actions">
                <button type="button" className="admin-btn success" onClick={() => void save()} disabled={saving} aria-busy={saving}>{saving ? 'Saving…' : 'Save service'}</button>
              </div>
            </div>
          </div>
        )}

        <div className="admin-card">
          <div className="admin-card-header"><h2>Catalogue</h2><span>{loading ? 'Loading…' : `${services.length} services`}</span></div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th scope="col">Service</th><th scope="col">Key</th><th scope="col">Destination</th><th scope="col">Order</th><th scope="col">State</th><th scope="col" className="right">Actions</th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan={6} className="empty-state">Loading catalogue…</td></tr>}
                {!loading && services.map((service) => (
                  <tr key={service.id}>
                    <td><b>{service.title}</b><div className="muted">{service.category || '—'}</div></td>
                    <td className="mono">{service.service_key}{service.is_form_service && <div className="muted">form service</div>}</td>
                    <td>{service.application_url
                      ? <a href={service.application_url} target="_blank" rel="noopener noreferrer">External</a>
                      : service.route ? <span className="mono">{service.route}</span>
                      : service.is_form_service ? <span className="muted">In-app form</span>
                      : <span className="muted">—</span>}</td>
                    <td>{service.sort_order ?? '—'}</td>
                    <td><StatusBadge status={service.active ? 'published' : 'unpaid'} /></td>
                    <td className="right">
                      <div className="admin-action-row">
                        <button type="button" className="admin-btn small" onClick={() => setEdit({
                          id: service.id,
                          service_key: service.service_key,
                          title: service.title,
                          description: service.description || '',
                          application_url: service.application_url || '',
                          route: service.route || '',
                          category: service.category || '',
                          sort_order: String(service.sort_order ?? 100),
                          active: service.active,
                          is_form_service: Boolean(service.is_form_service),
                        })}><Pencil size={12} /> Edit</button>
                        <button type="button" className="admin-btn small" onClick={() => void toggleActive(service)}>{service.active ? 'Hide' : 'Show'}</button>
                        <button type="button" className="admin-btn small" onClick={() => setGuideService(service)}><BookOpen size={12} /> Guide</button>
                        {!service.is_form_service && (
                          <button type="button" className="admin-text-btn danger-text" aria-label={`Delete ${service.title || service.category || 'this service'}`} onClick={() => void remove(service)}><Trash2 size={12} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && !services.length && (
                  <tr><td colSpan={6} className="empty-state">
                    <AdminEmptyState title="Catalogue is empty" hint="Create the first service. It appears on the live /services page immediately." />
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        {guideService && <GuideEditor service={guideService} onClose={() => setGuideService(null)} onNotice={setMessage} />}
        <p className="admin-footnote">Built-in form services (NELFUND loan, Results, JAMB slip, Admission letters) are protected: they can be edited, reordered, hidden or shown, but not deleted: their application forms are part of the code release.</p>
      </div>
  );
}
