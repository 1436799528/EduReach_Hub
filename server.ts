import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin, type AdminRequest } from './middleware';

export const app = express();
const PORT = Number(process.env.PORT || 3000);
const LIVE_SERVICE_KEYS = ['nelfund-loan', 'results', 'jamb-slip', 'admission-letters'] as const;
app.disable('x-powered-by');

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self' https://wa.me; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-src 'self'",
  );
  next();
});

function isServerSupabaseConfigured() {
  return Boolean(process.env.VITE_SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY));
}

function getServerSupabase() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !key) throw new Error('Supabase server configuration is incomplete.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function requireUser(req: express.Request) {
  const auth = req.header('authorization');
  if (!auth?.startsWith('Bearer ')) throw new Error('Authentication required.');
  const token = auth.slice('Bearer '.length);
  const supabase = getServerSupabase();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error('Invalid or expired session.');
  return { supabase, user: data.user };
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'edureach' });
});


app.use(express.json({ limit: '1mb' }));

app.post('/api/admin/bootstrap', async (req, res) => {
  try {
    const configuredEmail = String(process.env.EDUREACH_ADMIN_BOOTSTRAP_EMAIL || '').trim().toLowerCase();
    if (!configuredEmail) return res.status(503).json({ error: 'Admin bootstrap email is not configured.' });
    const auth = req.header('authorization');
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required.' });
    const supabase = getServerSupabase();
    const token = auth.slice('Bearer '.length).trim();
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user?.email) return res.status(401).json({ error: 'Invalid or expired session.' });
    if (authData.user.email.toLowerCase() !== configuredEmail) return res.status(403).json({ error: 'This account is not the configured EduReach administrator.' });
    const { data, error } = await supabase.rpc('admin_bootstrap_first_admin', { p_user_id: authData.user.id, p_email: configuredEmail });
    if (error) throw error;
    if (!data) return res.status(409).json({ error: 'Admin bootstrap is already locked or the account does not match.' });
    res.json({ success: true, role: 'super_admin' });
  } catch (error) {
    console.error('Admin bootstrap error:', error);
    res.status(500).json({ error: 'Unable to bootstrap the first administrator.' });
  }
});

app.get('/api/admin/session', requireAdmin, async (req, res) => {
  const adminUser = (req as AdminRequest).adminUser!;
  res.json({
    user: {
      id: adminUser.id,
      email: adminUser.email,
      fullName: adminUser.fullName,
      role: adminUser.role,
    },
  });
});

app.get('/api/admin/analytics', requireAdmin, async (_req, res) => {
  try {
    const supabase = getServerSupabase();
    const { data: metrics, error: metricError } = await supabase.rpc('admin_dashboard_metrics');
    if (metricError) throw metricError;
    const [audit, recentRequests, recentUsers] = await Promise.all([
      supabase.from('edureach_audit_logs').select('id,action,entity_type,entity_id,metadata,created_at').order('created_at',{ascending:false}).limit(20),
      supabase.from('service_requests').select('id,reference_code,status,created_at,updated_at,service_catalog(title)').order('created_at',{ascending:false}).limit(10),
      supabase.from('profiles').select('id,full_name,role,created_at').order('created_at',{ascending:false}).limit(10)
    ]);
    res.json({ metrics: metrics || {}, audit: audit.data || [], recentRequests: recentRequests.data || [], recentUsers: recentUsers.data || [] });
  } catch (error) {
    console.error('Admin analytics error:', error);
    res.status(503).json({ error: 'Unable to load administrative analytics.' });
  }
});

app.post('/api/analytics/event', async (req, res) => {
  if (!isServerSupabaseConfigured()) return res.status(204).end();
  try {
    const eventName = String(req.body?.event_name || '').trim().slice(0,80);
    const pathName = String(req.body?.path || '').trim().slice(0,500);
    const sessionId = String(req.body?.session_id || '').trim().slice(0,120);
    if (!eventName || !sessionId) return res.status(400).json({ error: 'event_name and session_id are required.' });
    if (!/^page_view$|^service_view$|^service_submit$|^cbt_start$|^cbt_submit$|^search$/.test(eventName)) return res.status(400).json({ error: 'Unsupported analytics event.' });
    const supabase = getServerSupabase();
    const auth = req.header('authorization');
    let userId: string | null = null;
    if (auth?.startsWith('Bearer ')) {
      const { data } = await supabase.auth.getUser(auth.slice('Bearer '.length).trim());
      userId = data.user?.id || null;
    }
    const { error } = await supabase.from('site_analytics_events').insert({
      event_name:eventName,path:pathName || null,session_id:sessionId,user_id:userId,
      referrer:String(req.body?.referrer || '').slice(0,1000) || null,
      user_agent:String(req.headers['user-agent'] || '').slice(0,1000) || null,
      metadata:req.body?.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : {}
    });
    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    console.error('Analytics event error:', error);
    res.status(204).end();
  }
});

app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const supabase = getServerSupabase();
    let query = supabase.from('profiles').select('id,full_name,school,faculty,department,level,role,matric_number,created_at').order('created_at', { ascending: false }).limit(200);
    if (search) {
      const safe = search.replace(/[%,_]/g, '');
      if (safe) query = query.or(`full_name.ilike.%${safe}%,school.ilike.%${safe}%,department.ilike.%${safe}%,matric_number.ilike.%${safe}%`);
    }
    const { data, error } = await query;
    if (error) throw error;
    res.json({ items: data || [] });
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(503).json({ error: 'Unable to load student accounts.' });
  }
});

app.get('/api/admin/service-requests', requireAdmin, async (req, res) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : 'all';
    const allowed = ['all','submitted','reviewing','processing','awaiting_information','completed','closed','rejected','cancelled'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status filter.' });
    const supabase = getServerSupabase();
    let query = supabase.from('service_requests').select('id,user_id,status,form_data,created_at,updated_at,reference_code,service_catalog(title)').order('created_at', { ascending: false }).limit(200);
    if (status !== 'all') query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ items: data || [] });
  } catch (error) {
    console.error('Admin service queue error:', error);
    res.status(503).json({ error: 'Unable to load service queue.' });
  }
});

app.patch('/api/admin/service-requests/:requestId', requireAdmin, async (req, res) => {
  try {
    const adminUser = (req as AdminRequest).adminUser!;
    const nextStatus = String(req.body?.status || '');
    const allowed = ['submitted','reviewing','processing','awaiting_information','completed','closed','rejected','cancelled'];
    if (!allowed.includes(nextStatus)) return res.status(400).json({ error: 'Invalid service status.' });
    const supabase = getServerSupabase();
    const { data: request, error: requestError } = await supabase.from('service_requests').select('id,status').eq('id', req.params.requestId).single();
    if (requestError || !request) return res.status(404).json({ error: 'Service request not found.' });
    const transitions: Record<string, string[]> = {
      submitted: ['reviewing','processing','awaiting_information','rejected','cancelled'],
      reviewing: ['processing','awaiting_information','completed','rejected','cancelled'],
      processing: ['awaiting_information','completed','rejected','cancelled'],
      awaiting_information: ['reviewing','processing','completed','cancelled'],
      completed: ['closed'],
      closed: [],
      rejected: [],
      cancelled: [],
    };
    if (!transitions[request.status]?.includes(nextStatus)) return res.status(409).json({ error: `Cannot change status from ${request.status} to ${nextStatus}.` });
    const { data, error } = await supabase.from('service_requests').update({ status: nextStatus, updated_at: new Date().toISOString() }).eq('id', request.id).select('id,status,updated_at').single();
    if (error) throw error;
    await supabase.rpc('admin_audit_log', { p_admin_user_id: adminUser.id, p_action: 'status_change', p_entity_type: 'service_request', p_entity_id: request.id, p_metadata: { from: request.status, to: nextStatus } });
    res.json({ item: data });
  } catch (error) {
    console.error('Admin service status error:', error);
    res.status(500).json({ error: 'Unable to update service request.' });
  }
});

app.get('/api/admin/cbt/exams', requireAdmin, async (req, res) => {
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase.from('cbt_exams').select('id,title,exam_body,subject,description,duration_minutes,is_active,created_at').order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ items: data || [] });
  } catch (error) {
    console.error('Admin CBT exams error:', error);
    res.status(503).json({ error: 'Unable to load CBT exams.' });
  }
});

app.post('/api/admin/cbt/exams', requireAdmin, async (req, res) => {
  try {
    const adminUser = (req as AdminRequest).adminUser!;
    const { title, exam_body, subject, description, duration_minutes, is_active } = req.body || {};
    const duration = Number(duration_minutes);
    if (!title?.trim() || !exam_body?.trim() || !subject?.trim() || !Number.isInteger(duration) || duration < 5 || duration > 180) {
      return res.status(400).json({ error: 'Valid title, exam body, subject and duration are required.' });
    }
    const supabase = getServerSupabase();
    const { data, error } = await supabase.from('cbt_exams').insert({
      title: title.trim(), exam_body: exam_body.trim().toUpperCase(), subject: subject.trim(),
      description: description?.trim() || null, duration_minutes: duration, is_active: is_active !== false,
      created_by: adminUser.id,
    }).select('id,title,exam_body,subject,description,duration_minutes,is_active,created_at').single();
    if (error) throw error;
    await supabase.rpc('admin_audit_log', { p_admin_user_id: adminUser.id, p_action: 'create', p_entity_type: 'cbt_exam', p_entity_id: data.id, p_metadata: { title: data.title } });
    res.status(201).json({ item: data });
  } catch (error) {
    console.error('Admin CBT exam create error:', error);
    res.status(500).json({ error: 'Unable to create CBT exam.' });
  }
});

app.get('/api/admin/cbt/exams/:examId/questions', requireAdmin, async (req, res) => {
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase.from('exam_questions').select('id,exam_id,question_text,option_a,option_b,option_c,option_d,correct_option,explanation,marks,position').eq('exam_id', req.params.examId).order('position', { ascending: true });
    if (error) throw error;
    res.json({ items: data || [] });
  } catch (error) {
    console.error('Admin CBT questions error:', error);
    res.status(503).json({ error: 'Unable to load CBT questions.' });
  }
});

app.post('/api/admin/cbt/exams/:examId/questions', requireAdmin, async (req, res) => {
  try {
    const adminUser = (req as AdminRequest).adminUser!;
    const { question_text, option_a, option_b, option_c, option_d, correct_option, explanation, marks, position } = req.body || {};
    const numericMarks = Number(marks || 1); const numericPosition = Number(position);
    if (!question_text?.trim() || !option_a?.trim() || !option_b?.trim() || !option_c?.trim() || !option_d?.trim() ||
      !['A','B','C','D'].includes(correct_option) || !Number.isInteger(numericMarks) || numericMarks < 1 ||
      !Number.isInteger(numericPosition) || numericPosition < 1) return res.status(400).json({ error: 'Invalid CBT question data.' });
    const supabase = getServerSupabase();
    const { data: exam } = await supabase.from('cbt_exams').select('id').eq('id', req.params.examId).maybeSingle();
    if (!exam) return res.status(404).json({ error: 'CBT exam not found.' });
    const { data, error } = await supabase.from('exam_questions').insert({
      exam_id: exam.id, question_text: question_text.trim(), option_a: option_a.trim(), option_b: option_b.trim(),
      option_c: option_c.trim(), option_d: option_d.trim(), correct_option, explanation: explanation?.trim() || null,
      marks: numericMarks, position: numericPosition,
    }).select('id,exam_id,question_text,option_a,option_b,option_c,option_d,correct_option,explanation,marks,position').single();
    if (error) throw error;
    await supabase.rpc('admin_audit_log', { p_admin_user_id: adminUser.id, p_action: 'create', p_entity_type: 'exam_question', p_entity_id: data.id, p_metadata: { exam_id: exam.id, position: numericPosition } });
    res.status(201).json({ item: data });
  } catch (error) {
    console.error('Admin CBT question create error:', error);
    const message = error instanceof Error && error.message.includes('duplicate') ? 'That question position is already in use.' : 'Unable to create CBT question.';
    res.status(400).json({ error: message });
  }
});

app.patch('/api/admin/cbt/questions/:questionId', requireAdmin, async (req, res) => {
  try {
    const adminUser = (req as AdminRequest).adminUser!;
    const { question_text, option_a, option_b, option_c, option_d, correct_option, explanation, marks, position } = req.body || {};
    const numericMarks = Number(marks || 1); const numericPosition = Number(position);
    if (!question_text?.trim() || !option_a?.trim() || !option_b?.trim() || !option_c?.trim() || !option_d?.trim() ||
      !['A','B','C','D'].includes(correct_option) || !Number.isInteger(numericMarks) || numericMarks < 1 ||
      !Number.isInteger(numericPosition) || numericPosition < 1) return res.status(400).json({ error: 'Invalid CBT question data.' });
    const supabase = getServerSupabase();
    const { data, error } = await supabase.from('exam_questions').update({
      question_text: question_text.trim(), option_a: option_a.trim(), option_b: option_b.trim(), option_c: option_c.trim(),
      option_d: option_d.trim(), correct_option, explanation: explanation?.trim() || null, marks: numericMarks, position: numericPosition,
      updated_at: new Date().toISOString(),
    }).eq('id', req.params.questionId).select('id,exam_id,question_text,option_a,option_b,option_c,option_d,correct_option,explanation,marks,position').single();
    if (error) throw error;
    await supabase.rpc('admin_audit_log', { p_admin_user_id: adminUser.id, p_action: 'update', p_entity_type: 'exam_question', p_entity_id: data.id, p_metadata: { position: numericPosition } });
    res.json({ item: data });
  } catch (error) {
    console.error('Admin CBT question update error:', error);
    const message = error instanceof Error && error.message.includes('duplicate') ? 'That question position is already in use.' : 'Unable to update CBT question.';
    res.status(400).json({ error: message });
  }
});

app.delete('/api/admin/cbt/questions/:questionId', requireAdmin, async (req, res) => {
  try {
    const adminUser = (req as AdminRequest).adminUser!;
    const supabase = getServerSupabase();
    const { data, error } = await supabase.from('exam_questions').delete().eq('id', req.params.questionId).select('id,exam_id').single();
    if (error) throw error;
    await supabase.rpc('admin_audit_log', { p_admin_user_id: adminUser.id, p_action: 'delete', p_entity_type: 'exam_question', p_entity_id: data.id, p_metadata: { exam_id: data.exam_id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Admin CBT question delete error:', error);
    res.status(500).json({ error: 'Unable to remove CBT question.' });
  }
});

function slugifyTitle(title: string): string {
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'article';
}

function safeContentUrl(value: unknown): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

async function uniqueNewsSlug(supabase: any, base: string, excludeId?: string): Promise<string> {
  let candidate = base;
  for (let attempt = 0; attempt < 25; attempt++) {
    let query = supabase.from('news_articles').select('id').eq('slug', candidate).limit(1);
    if (excludeId) query = query.neq('id', excludeId);
    const { data } = await query;
    if (!data || data.length === 0) return candidate;
    candidate = `${base}-${attempt + 2}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

const newsRowSelect = 'id,slug,title,excerpt,body,category,image_url,source_name,source_url,published,published_at,updated_at';

app.get('/api/admin/news', requireAdmin, async (_req, res) => {
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase.from('news_articles').select(newsRowSelect).order('updated_at', { ascending: false }).limit(200);
    if (error) throw error;
    res.json({ items: data || [] });
  } catch (error) {
    console.error('Admin news list error:', error);
    res.status(503).json({ error: 'Unable to load newsroom articles.' });
  }
});

app.post('/api/admin/news', requireAdmin, async (req, res) => {
  try {
    const adminUser = (req as AdminRequest).adminUser!;
    const title = String(req.body?.title || '').trim();
    const bodyText = String(req.body?.body || '').trim();
    if (!title || !bodyText) return res.status(400).json({ error: 'Article title and body are required.' });
    const supabase = getServerSupabase();
    const base = slugifyTitle(String(req.body?.slug || title));
    const slug = await uniqueNewsSlug(supabase, base);
    const imageUrl = safeContentUrl(req.body?.image_url);
    const sourceUrl = safeContentUrl(req.body?.source_url);
    if ((req.body?.image_url && !imageUrl) || (req.body?.source_url && !sourceUrl)) {
      return res.status(400).json({ error: 'Image and source links must use HTTPS or a site-relative path.' });
    }
    const published = req.body?.published === true;
    const now = new Date().toISOString();
    const row = {
      slug,
      title,
      excerpt: req.body?.excerpt ? String(req.body.excerpt).trim() : null,
      body: bodyText,
      category: String(req.body?.category || 'general').trim().toLowerCase() || 'general',
      image_url: imageUrl,
      source_name: req.body?.source_name ? String(req.body.source_name).trim() : null,
      source_url: sourceUrl,
      published,
      published_at: published ? now : null,
    };
    const { data, error } = await supabase.from('news_articles').insert(row).select(newsRowSelect).single();
    if (error) throw error;
    await supabase.rpc('admin_audit_log', { p_admin_user_id: adminUser.id, p_action: 'news_create', p_entity_type: 'news_article', p_entity_id: data.id, p_metadata: { slug } });
    res.status(201).json({ item: data });
  } catch (error) {
    console.error('Admin news create error:', error);
    res.status(500).json({ error: 'Unable to create this article.' });
  }
});

app.patch('/api/admin/news/:articleId', requireAdmin, async (req, res) => {
  try {
    const adminUser = (req as AdminRequest).adminUser!;
    const supabase = getServerSupabase();
    const { data: existing, error: existingError } = await supabase.from('news_articles').select('id,slug,published,published_at').eq('id', req.params.articleId).single();
    if (existingError || !existing) return res.status(404).json({ error: 'News article not found.' });
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (req.body?.title !== undefined) {
      const title = String(req.body.title).trim();
      if (!title) return res.status(400).json({ error: 'Article title cannot be empty.' });
      patch.title = title;
    }
    if (req.body?.slug !== undefined) {
      const base = slugifyTitle(String(req.body.slug || (patch.title as string) || existing.slug));
      patch.slug = await uniqueNewsSlug(supabase, base, existing.id);
    }
    if (req.body?.body !== undefined) {
      const bodyText = String(req.body.body).trim();
      if (!bodyText) return res.status(400).json({ error: 'Article body cannot be empty.' });
      patch.body = bodyText;
    }
    if (req.body?.excerpt !== undefined) patch.excerpt = req.body.excerpt ? String(req.body.excerpt).trim() : null;
    if (req.body?.category !== undefined) patch.category = String(req.body.category).trim().toLowerCase() || 'general';
    if (req.body?.image_url !== undefined) {
      const imageUrl = safeContentUrl(req.body.image_url);
      if (req.body.image_url && !imageUrl) return res.status(400).json({ error: 'Image links must use HTTPS or a site-relative path.' });
      patch.image_url = imageUrl;
    }
    if (req.body?.source_name !== undefined) patch.source_name = req.body.source_name ? String(req.body.source_name).trim() : null;
    if (req.body?.source_url !== undefined) {
      const sourceUrl = safeContentUrl(req.body.source_url);
      if (req.body.source_url && !sourceUrl) return res.status(400).json({ error: 'Source links must use HTTPS or a site-relative path.' });
      patch.source_url = sourceUrl;
    }
    if (req.body?.published !== undefined) {
      const published = req.body.published === true;
      patch.published = published;
      if (published && !existing.published_at) patch.published_at = new Date().toISOString();
      if (!published) patch.published_at = null;
    }
    const { data, error } = await supabase.from('news_articles').update(patch).eq('id', existing.id).select(newsRowSelect).single();
    if (error) throw error;
    await supabase.rpc('admin_audit_log', { p_admin_user_id: adminUser.id, p_action: 'news_update', p_entity_type: 'news_article', p_entity_id: existing.id, p_metadata: { slug: data.slug } });
    res.json({ item: data });
  } catch (error) {
    console.error('Admin news update error:', error);
    res.status(500).json({ error: 'Unable to update this article.' });
  }
});

app.delete('/api/admin/news/:articleId', requireAdmin, async (req, res) => {
  try {
    const adminUser = (req as AdminRequest).adminUser!;
    const supabase = getServerSupabase();
    const { data: existing, error: existingError } = await supabase.from('news_articles').select('id,slug').eq('id', req.params.articleId).single();
    if (existingError || !existing) return res.status(404).json({ error: 'News article not found.' });
    const { error } = await supabase.from('news_articles').delete().eq('id', existing.id);
    if (error) throw error;
    await supabase.rpc('admin_audit_log', { p_admin_user_id: adminUser.id, p_action: 'news_delete', p_entity_type: 'news_article', p_entity_id: existing.id, p_metadata: { slug: existing.slug } });
    res.json({ deleted: true });
  } catch (error) {
    console.error('Admin news delete error:', error);
    res.status(500).json({ error: 'Unable to delete this article.' });
  }
});

app.post('/api/admin/session/verify', requireAdmin, (_req, res) => {
  res.json({ authenticated: true });
});

app.get('/api/services', async (_req, res) => {
  if (!isServerSupabaseConfigured()) return res.json({ items: [] });
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('service_catalog')
      .select('id,service_key,title,description,application_url,active')
      .in('service_key', [...LIVE_SERVICE_KEYS])
      .eq('active', true)
      .order('title');
    if (error) throw error;
    res.json({ items: data || [] });
  } catch (error) {
    console.error('Services API error:', error);
    res.status(503).json({ error: 'Services are temporarily unavailable.' });
  }
});

app.get('/api/services/:slug', async (req, res) => {
  const slug = req.params.slug.trim().toLowerCase();
  if (!LIVE_SERVICE_KEYS.includes(slug as (typeof LIVE_SERVICE_KEYS)[number])) return res.status(404).json({ error: 'Service not found.' });
  if (!isServerSupabaseConfigured()) return res.status(404).json({ error: 'Service catalog is not configured.' });
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('service_catalog')
      .select('id,service_key,title,description,application_url,active')
      .eq('service_key', slug)
      .eq('active', true)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Service not found.' });
    res.json({ item: data });
  } catch (error) {
    console.error('Service API error:', error);
    res.status(503).json({ error: 'Service is temporarily unavailable.' });
  }
});

app.get('/api/upcoming', async (_req, res) => {
  if (!isServerSupabaseConfigured()) return res.json({ items: [] });
  try {
    const supabase = getServerSupabase();
    const [deadlinesResult, examsResult] = await Promise.all([
      supabase
        .from('edureach_deadlines')
        .select('id,title,description,due_at,priority')
        .is('institution_id', null)
        .is('user_id', null)
        .eq('status', 'pending')
        .gte('due_at', new Date().toISOString())
        .order('due_at', { ascending: true })
        .limit(8),
      supabase
        .from('edureach_exams')
        .select('id,title,description,starts_at,ends_at,location,priority')
        .is('institution_id', null)
        .is('user_id', null)
        .eq('status', 'pending')
        .gte('starts_at', new Date().toISOString())
        .order('starts_at', { ascending: true })
        .limit(8),
    ]);

    if (deadlinesResult.error) throw deadlinesResult.error;
    if (examsResult.error) throw examsResult.error;

    const items = [
      ...(deadlinesResult.data || []).map((item) => ({ ...item, kind: 'deadline' as const, starts_at: null, location: null })),
      ...(examsResult.data || []).map((item) => ({ ...item, kind: 'exam' as const, due_at: null })),
    ].sort((a, b) => {
      const aDate = new Date(a.due_at || a.starts_at || 0).getTime();
      const bDate = new Date(b.due_at || b.starts_at || 0).getTime();
      return aDate - bDate;
    }).slice(0, 10);

    res.json({ items });
  } catch (error) {
    console.error('Upcoming API error:', error);
    res.status(503).json({ error: 'Upcoming items are temporarily unavailable.' });
  }
});

app.get('/api/news', async (_req, res) => {
  if (!isServerSupabaseConfigured()) return res.json({ items: [] });
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase.from('news_articles')
      .select('id,slug,title,excerpt,body,category,image_url,source_name,source_url,published_at,updated_at,published')
      .eq('published', true).order('published_at', { ascending: false, nullsFirst: false }).limit(30);
    if (error) throw error;
    res.json({ items: (data || []).map(item => ({ ...item, author: item.source_name || 'EduReach Editorial Desk', summary: item.excerpt, last_verified_at: item.updated_at, verification_status: 'verified', priority: 'normal' })) });
  } catch (error) {
    console.error('News API error:', error);
    res.status(503).json({ error: 'News service is temporarily unavailable.' });
  }
});

app.get('/api/news/:slug', async (req, res) => {
  if (!isServerSupabaseConfigured()) return res.status(404).json({ error: 'News content is not configured.' });
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase.from('news_articles')
      .select('id,slug,title,excerpt,body,category,image_url,source_name,source_url,published_at,updated_at,published')
      .eq('slug', req.params.slug).eq('published', true).maybeSingle();
    if (error || !data) return res.status(404).json({ error: 'News article not found.' });
    res.json({ item: { ...data, author: data.source_name || 'EduReach Editorial Desk', summary: data.excerpt, last_verified_at: data.updated_at, verification_status: 'verified', priority: 'normal' } });
  } catch (error) {
    console.error('News article API error:', error);
    res.status(503).json({ error: 'News service is temporarily unavailable.' });
  }
});

app.post('/api/cbt/exams/:examId/start', async (req, res) => {
  try {
    const { supabase, user } = await requireUser(req);
    const { data: exam, error: examError } = await supabase.from('cbt_exams').select('id,title,duration_minutes,subject,is_active').eq('id', req.params.examId).eq('is_active', true).single();
    if (examError || !exam) return res.status(404).json({ error: 'CBT exam not found.' });
    const { count, error: countError } = await supabase.from('exam_questions').select('id', { count: 'exact', head: true }).eq('exam_id', exam.id);
    if (countError) throw countError;
    if (!count) return res.status(422).json({ error: 'This CBT exam has no questions yet.' });
    const now = new Date();
    const { data: existingAttempt } = await supabase
      .from('cbt_attempts')
      .select('id,started_at,expires_at,total_questions,status')
      .eq('user_id', user.id)
      .eq('exam_id', exam.id)
      .eq('status', 'in_progress')
      .maybeSingle();

    if (existingAttempt) {
      const existingExpiry = existingAttempt.expires_at ? new Date(existingAttempt.expires_at) : null;
      if (!existingExpiry || existingExpiry.getTime() > now.getTime()) {
        return res.status(200).json({
          attemptId: existingAttempt.id,
          startedAt: existingAttempt.started_at,
          expiresAt: existingAttempt.expires_at,
          totalQuestions: existingAttempt.total_questions,
        });
      }
      await supabase
        .from('cbt_attempts')
        .update({ status: 'expired', updated_at: now.toISOString() })
        .eq('id', existingAttempt.id)
        .eq('status', 'in_progress');
    }

    const startedAt = now;
    const expiresAt = new Date(startedAt.getTime() + exam.duration_minutes * 60 * 1000);
    const { data: attempt, error: attemptError } = await supabase.from('cbt_attempts').insert({
      user_id: user.id,
      exam_id: exam.id,
      status: 'in_progress',
      started_at: startedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      total_questions: count,
    }).select('id,started_at,expires_at,total_questions').single();
    if (attemptError || !attempt) {
      if (attemptError?.code === '23505') {
        const { data: retryAttempt } = await supabase
          .from('cbt_attempts')
          .select('id,started_at,expires_at,total_questions')
          .eq('user_id', user.id)
          .eq('exam_id', exam.id)
          .eq('status', 'in_progress')
          .maybeSingle();
        if (retryAttempt) {
          return res.status(200).json({
            attemptId: retryAttempt.id,
            startedAt: retryAttempt.started_at,
            expiresAt: retryAttempt.expires_at,
            totalQuestions: retryAttempt.total_questions,
          });
        }
      }
      throw attemptError || new Error('Unable to start CBT attempt.');
    }
    res.status(201).json({ attemptId: attempt.id, startedAt: attempt.started_at, expiresAt: attempt.expires_at, totalQuestions: attempt.total_questions });
  } catch (error) {
    console.error('CBT start API error:', error);
    const message = error instanceof Error ? error.message : 'Unable to start CBT exam.';
    res.status(message.includes('Authentication') || message.includes('session') ? 401 : 500).json({ error: message });
  }
});

app.get('/api/cbt/exams/:examId/guest-questions', async (req, res) => {
  if (!isServerSupabaseConfigured()) return res.status(404).json({ error: 'CBT question bank is not configured.' });
  try {
    const supabase = getServerSupabase();
    const { data: exam, error: examError } = await supabase
      .from('cbt_exams')
      .select('id,title,exam_body,duration_minutes,subject,is_active')
      .eq('id', req.params.examId)
      .eq('is_active', true)
      .maybeSingle();
    if (examError || !exam) return res.status(404).json({ error: 'CBT exam not found.' });
    const { data: questions, error: questionsError } = await supabase
      .from('exam_questions')
      .select('position,question_text,option_a,option_b,option_c,option_d')
      .eq('exam_id', exam.id)
      .order('position', { ascending: true });
    if (questionsError) throw questionsError;
    if (!questions?.length) return res.status(422).json({ error: 'This CBT exam has no questions yet.' });
    res.json({
      exam: { id: exam.id, title: exam.title, examBody: exam.exam_body, durationMinutes: exam.duration_minutes, subject: exam.subject },
      questions: questions.map((q) => ({ id: q.position, text: q.question_text, options: [q.option_a, q.option_b, q.option_c, q.option_d] })),
    });
  } catch (error) {
    console.error('Guest CBT question API error:', error);
    res.status(503).json({ error: 'CBT service is temporarily unavailable.' });
  }
});

app.post('/api/cbt/guest-submit', async (req, res) => {
  if (!isServerSupabaseConfigured()) return res.status(404).json({ error: 'CBT question bank is not configured.' });
  try {
    const examId = String(req.body?.examId || '').trim();
    const answers = req.body?.answers as Record<string, unknown> | undefined;
    if (!examId || !answers || typeof answers !== 'object' || Array.isArray(answers)) {
      return res.status(400).json({ error: 'examId and answers are required.' });
    }
    const supabase = getServerSupabase();
    const { data: exam, error: examError } = await supabase
      .from('cbt_exams')
      .select('id,title,exam_body,duration_minutes,subject,is_active')
      .eq('id', examId)
      .eq('is_active', true)
      .maybeSingle();
    if (examError || !exam) return res.status(404).json({ error: 'CBT exam not found.' });
    const { data: questions, error: questionsError } = await supabase
      .from('exam_questions')
      .select('id,position,question_text,option_a,option_b,option_c,option_d,correct_option,explanation')
      .eq('exam_id', exam.id)
      .order('position', { ascending: true });
    if (questionsError) throw questionsError;
    if (!questions?.length) return res.status(422).json({ error: 'This CBT exam has no questions yet.' });
    const breakdown = questions.map((question) => {
      const raw = answers[String(question.position)];
      const valid = raw === null || raw === undefined || (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw <= 3);
      if (!valid) throw new Error(`Invalid answer for question ${question.position}.`);
      const selected = raw === undefined || raw === null ? null : Number(raw);
      const selectedOption = selected === null ? null : String.fromCharCode(65 + selected);
      const correctIndex = question.correct_option.charCodeAt(0) - 65;
      return { question: question.position, selected, correct: correctIndex, isCorrect: selectedOption === question.correct_option, explanation: question.explanation || null, questionId: question.id };
    });
    const correctAnswers = breakdown.filter((item) => item.isCorrect).length;
    const score = Number(((correctAnswers / questions.length) * 100).toFixed(2));
    const attemptId = `guest-cbt-${crypto.randomUUID()}`;
    res.json({
      attemptId,
      score,
      exam: { id: exam.id, title: exam.title, examBody: exam.exam_body, durationMinutes: exam.duration_minutes, subject: exam.subject },
      attempt: { id: attemptId, exam_id: exam.id, score, correct_answers: correctAnswers, total_questions: questions.length, submitted_at: new Date().toISOString(), guest: true },
      answers: breakdown.map((item) => ({ question_id: item.questionId, selected_option: item.selected === null ? null : String.fromCharCode(65 + item.selected), is_correct: item.isCorrect })),
      questions: questions.map((question) => ({ id: question.id, position: question.position, question_text: question.question_text, option_a: question.option_a, option_b: question.option_b, option_c: question.option_c, option_d: question.option_d, correct_option: question.correct_option, explanation: question.explanation })),
      breakdown: breakdown.map(({ question, selected, correct, explanation }) => ({ question, selected, correct, explanation: explanation || undefined })),
    });
  } catch (error) {
    console.error('Guest CBT submit API error:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Guest CBT submission failed.' });
  }
});

app.get('/api/cbt/attempts/:attemptId/progress', async (req, res) => {
  try {
    const { supabase, user } = await requireUser(req);
    const { data: attempt, error: attemptError } = await supabase
      .from('cbt_attempts')
      .select('id,exam_id,status,current_question')
      .eq('id', req.params.attemptId)
      .eq('user_id', user.id)
      .eq('status', 'in_progress')
      .maybeSingle();
    if (attemptError || !attempt) return res.status(404).json({ error: 'Active CBT attempt not found.' });
    const { data: answers, error: answerError } = await supabase.from('cbt_answers').select('question_id,selected_option').eq('attempt_id', attempt.id);
    if (answerError) throw answerError;
    const questionIds = (answers || []).map((answer) => answer.question_id);
    const { data: questions, error: questionError } = questionIds.length
      ? await supabase.from('exam_questions').select('id,position').in('id', questionIds)
      : { data: [], error: null };
    if (questionError) throw questionError;
    const positions = new Map((questions || []).map((question) => [question.id, question.position]));
    const progress: Record<string, number> = {};
    for (const answer of answers || []) {
      const position = positions.get(answer.question_id);
      if (position !== undefined && answer.selected_option) progress[String(position)] = answer.selected_option.charCodeAt(0) - 65;
    }
    res.json({ examId: attempt.exam_id, answers: progress, questionIndex: Number(attempt.current_question || 0) });
  } catch (error) {
    console.error('CBT progress read error:', error);
    const message = error instanceof Error ? error.message : 'Unable to load CBT progress.';
    res.status(message.includes('Authentication') ? 401 : 503).json({ error: message });
  }
});

app.patch('/api/cbt/attempts/:attemptId/progress', async (req, res) => {
  try {
    const { supabase, user } = await requireUser(req);
    const answers = req.body?.answers as Record<string, unknown> | undefined;
    const rawQuestionIndex = req.body?.questionIndex;
    const questionIndex = rawQuestionIndex === undefined ? null : Number(rawQuestionIndex);
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return res.status(400).json({ error: 'Answers are required.' });
    if (questionIndex !== null && (!Number.isInteger(questionIndex) || questionIndex < 0)) return res.status(400).json({ error: 'Question position is invalid.' });
    const { data: attempt, error: attemptError } = await supabase
      .from('cbt_attempts')
      .select('id,exam_id,status')
      .eq('id', req.params.attemptId)
      .eq('user_id', user.id)
      .eq('status', 'in_progress')
      .maybeSingle();
    if (attemptError || !attempt) return res.status(404).json({ error: 'Active CBT attempt not found.' });
    const { data: questions, error: questionError } = await supabase.from('exam_questions').select('id,position,correct_option').eq('exam_id', attempt.exam_id);
    if (questionError) throw questionError;
    const rows = Object.entries(answers).flatMap(([position, raw]) => {
      const question = (questions || []).find((item) => String(item.position) === position);
      if (!question || raw === null || raw === undefined) return [];
      if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0 || raw > 3) return [];
      const selectedOption = String.fromCharCode(65 + raw);
      return [{ attempt_id: attempt.id, question_id: question.id, selected_option: selectedOption, is_correct: selectedOption === question.correct_option }];
    });
    if (rows.length) {
      const { error } = await supabase.from('cbt_answers').upsert(rows, { onConflict: 'attempt_id,question_id' });
      if (error) throw error;
    }
    if (questionIndex !== null) {
      const { error } = await supabase.from('cbt_attempts').update({ current_question: questionIndex, updated_at: new Date().toISOString() }).eq('id', attempt.id).eq('status', 'in_progress');
      if (error) throw error;
    }
    res.status(204).end();
  } catch (error) {
    console.error('CBT progress save error:', error);
    const message = error instanceof Error ? error.message : 'Unable to save CBT progress.';
    res.status(message.includes('Authentication') ? 401 : 503).json({ error: message });
  }
});

app.get('/api/cbt/exams/:examId/questions', async (req, res) => {
  if (!isServerSupabaseConfigured()) return res.status(404).json({ error: 'CBT question bank is not configured.' });
  try {
    // This endpoint is retained for server integrations, but question delivery
    // is not public. The browser-facing Supabase RPC has the same authenticated
    // boundary and never exposes correct options before submission.
    const { supabase } = await requireUser(req);
    const { data: exam, error: examError } = await supabase.from('cbt_exams').select('id,title,duration_minutes,subject,is_active').eq('id', req.params.examId).eq('is_active', true).single();
    if (examError || !exam) return res.status(404).json({ error: 'CBT exam not found.' });
    const { data: questions, error: questionsError } = await supabase.from('exam_questions').select('position,question_text,option_a,option_b,option_c,option_d').eq('exam_id', exam.id).order('position', { ascending: true });
    if (questionsError) throw questionsError;
    res.json({ exam: { id: exam.id, title: exam.title, durationMinutes: exam.duration_minutes, subject: exam.subject }, questions: (questions || []).map(q => ({ id: q.position, text: q.question_text, options: [q.option_a,q.option_b,q.option_c,q.option_d] })) });
  } catch (error) {
    console.error('CBT question API error:', error);
    const message = error instanceof Error ? error.message : 'CBT service is temporarily unavailable.';
    res.status(message.includes('Authentication') || message.includes('session') ? 401 : 503).json({ error: message.includes('Authentication') || message.includes('session') ? message : 'CBT service is temporarily unavailable.' });
  }
});

app.post('/api/cbt/submit', async (req, res) => {
  try {
    const { supabase, user } = await requireUser(req);
    const { attemptId, examId, answers } = req.body as { attemptId?: string; examId?: string; answers?: Record<string, unknown> };
    if (!attemptId || !examId || !answers || typeof answers !== 'object' || Array.isArray(answers)) return res.status(400).json({ error: 'attemptId, examId and answers are required.' });
    const { data: attempt, error: attemptError } = await supabase.from('cbt_attempts').select('id,exam_id,status,user_id,started_at,expires_at').eq('id', attemptId).eq('user_id', user.id).eq('exam_id', examId).single();
    if (attemptError || !attempt) return res.status(404).json({ error: 'CBT attempt not found.' });
    if (attempt.status !== 'in_progress') return res.status(409).json({ error: 'This CBT attempt has already been submitted.' });
    const now = new Date();
    if (attempt.expires_at && now.getTime() > new Date(attempt.expires_at).getTime()) {
      await supabase.from('cbt_attempts').update({ status: 'expired', updated_at: now.toISOString() }).eq('id', attempt.id);
      return res.status(409).json({ error: 'This CBT attempt has expired.' });
    }
    const { data: questions, error: questionsError } = await supabase.from('exam_questions').select('id,position,correct_option,explanation').eq('exam_id', examId).order('position', { ascending: true });
    if (questionsError) throw questionsError;
    if (!questions?.length) return res.status(422).json({ error: 'This CBT exam has no questions yet.' });
    const breakdown = questions.map(question => {
      const raw = answers[String(question.position)];
      const valid = raw === null || raw === undefined || (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw <= 3);
      if (!valid) throw new Error(`Invalid answer for question ${question.position}.`);
      const selected = raw === undefined || raw === null ? null : Number(raw);
      const selectedOption = selected === null ? null : String.fromCharCode(65 + selected);
      const correctIndex = question.correct_option.charCodeAt(0) - 65;
      return { question: question.position, selected, correct: correctIndex, isCorrect: selectedOption === question.correct_option, explanation: question.explanation || undefined, questionId: question.id };
    });
    for (const key of Object.keys(answers)) {
      if (!questions.some(q => String(q.position) === key)) return res.status(400).json({ error: 'Submission contains an invalid question.' });
    }
    const correctAnswers = breakdown.filter(x => x.isCorrect).length;
    const totalQuestions = questions.length;
    const score = Number(((correctAnswers / totalQuestions) * 100).toFixed(2));
    const { error: attemptUpdateError } = await supabase.from('cbt_attempts').update({ status:'submitted', submitted_at:now.toISOString(), score, correct_answers:correctAnswers, total_questions:totalQuestions, updated_at:now.toISOString() }).eq('id', attempt.id).eq('status','in_progress');
    if (attemptUpdateError) throw attemptUpdateError;
    const answerRows = breakdown.map(q => ({ attempt_id: attempt.id, question_id:q.questionId, selected_option:q.selected === null ? null : String.fromCharCode(65 + q.selected), is_correct:q.isCorrect }));
    const { error: answersError } = await supabase.from('cbt_answers').upsert(answerRows, { onConflict:'attempt_id,question_id' });
    if (answersError) throw answersError;
    res.json({ attemptId: attempt.id, score, breakdown: breakdown.map(({question,selected,correct,explanation}) => ({question,selected,correct,explanation})) });
  } catch (error) {
    console.error('CBT submit API error:', error);
    const message = error instanceof Error ? error.message : 'CBT submission failed.';
    res.status(message.includes('Authentication') || message.includes('session') ? 401 : 400).json({ error: message });
  }
});

// Never let an unknown API method/path fall through to the SPA HTML shell.
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined,
        ws: process.env.DISABLE_HMR === 'true' ? false : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => { res.sendFile(path.join(distPath, 'index.html')); });
  }
  app.listen(PORT, '0.0.0.0', () => console.log(`EduReach server running on port ${PORT}`));
}

if (!process.env.NETLIFY) {
  startServer();
}
