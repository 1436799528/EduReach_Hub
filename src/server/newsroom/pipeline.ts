/**
 * EduReach daily newsroom pipeline.
 *
 *   sources → fetch → parse → normalise → deduplicate → classify → quality gate
 *           → Supabase (candidate + article) → report
 *
 * What this replaces: the previous "daily news refresh" only repaired missing
 * images. It never discovered a story, never deduplicated one and never
 * published one, so "daily refresh" did not mean "daily news". This module is
 * the missing pipeline, and the image repair is kept as one step inside it.
 *
 * Editorial rules enforced here (documented in docs/NEWSROOM_PIPELINE.md):
 *   - Tier 1 official sources publish automatically, but only when relevance
 *     and the quality gate both pass and no duplicate signal fires.
 *   - Everything else lands in the review queue as a candidate. A human
 *     approves it before it can appear on the public news feed.
 *   - Candidates and articles store provenance: source key, source tier,
 *     source publication time, last verified time, verification state and an
 *     expiry date.
 *   - EduReach stores headline, source summary and attribution. It does not
 *     reproduce source article text.
 */

import { classify } from './classify';
import { buildIndexEntry, describeMatch, findDuplicate, type IndexEntry } from './dedupe';
import { HostThrottle, RobotsCache, looksLikeFeed, politeFetch } from './fetch';
import { extractPageMeta, discoverArticleLinks, parseFeed, parseJsonFeed, type ParsedItem } from './parse';
import { expiresAtFor, runQualityGate } from './qualityGate';
import { DEFAULT_SOURCES, sourceFromRegistryRow, type SourceDefinition } from './sources';
import {
  canonicalUrl,
  contentHash,
  dedupeKeyFor,
  hostOf,
  normalizeWhitespace,
  slugify,
  toPlainText,
  truncate,
} from './text';

/** Minimal surface of the Supabase admin client used here (stub-friendly). */
export interface NewsroomSupabase {
  from(table: string): any;
  rpc(fn: string, args?: Record<string, unknown>): any;
}

export interface IngestOptions {
  fetchImpl?: typeof fetch;
  now?: () => Date;
  dryRun?: boolean;
  triggeredBy?: 'schedule' | 'admin' | 'cli' | 'manual';
  userAgent?: string;
  maxItemsPerSource?: number;
  maxPageFetchesPerSource?: number;
  maxCandidates?: number;
  concurrency?: number;
  lookbackDays?: number;
  sources?: SourceDefinition[];
  relevanceThreshold?: number;
  autoPublishThreshold?: number;
  repairImages?: boolean;
  skipRobots?: boolean;
  log?: (message: string, meta?: Record<string, unknown>) => void;
}

export interface SourceOutcome {
  sourceKey: string;
  status: 'ok' | 'failed' | 'skipped';
  items: number;
  candidates: number;
  error?: string;
  durationMs: number;
}

export interface IngestDecision {
  title: string;
  sourceKey: string;
  status: 'published' | 'needs_review' | 'duplicate' | 'rejected' | 'failed';
  reason: string;
  category: string;
  url: string;
}

export interface IngestReport {
  runId: string | null;
  startedAt: string;
  finishedAt: string;
  dryRun: boolean;
  triggeredBy: string;
  sourcesChecked: number;
  sourcesFailed: number;
  candidatesFound: number;
  duplicates: number;
  rejected: number;
  needsReview: number;
  published: number;
  imagesRepaired: number;
  expired: number;
  perSource: SourceOutcome[];
  decisions: IngestDecision[];
  errors: string[];
}

const DEFAULTS = {
  maxItemsPerSource: 12,
  maxPageFetchesPerSource: 6,
  maxCandidates: 150,
  concurrency: 3,
  lookbackDays: 120,
};

/**
 * Category advisories appended to every ingested item. They are standing
 * guidance ("confirm on the official portal"), not generated claims about the
 * story, which is the line EduReach does not cross.
 */
const CATEGORY_ADVISORY: Record<string, string> = {
  jamb: 'Confirm every detail on your JAMB profile or at an accredited CBT centre before you act on it.',
  waec: 'Check the official WAEC Nigeria portal or your school exam officer for confirmation.',
  neco: 'Confirm dates and requirements through the official NECO portal or your school.',
  nabteb: 'Confirm dates and requirements through the official NABTEB portal or your centre.',
  nelfund: 'Applications and disbursements are handled on the official NELFUND portal. EduReach is an independent student-support platform and does not process loan applications.',
  admissions: 'Admission lists and cut-off marks are published by each institution. Verify on the school portal before paying anyone.',
  'post-utme': 'Screening dates and requirements are set by each institution. Verify on the school portal.',
  scholarships: 'Scholarship and grant applications are free unless the official notice says otherwise. Never pay a third party to submit an application.',
  universities: 'Verify programme accreditation and admission requirements with the institution.',
  polytechnics: 'Verify programme accreditation and admission requirements with the institution.',
  'colleges-of-education': 'Verify programme accreditation and admission requirements with the institution.',
  'academic-calendar': 'Academic calendars change. Confirm resumption and examination dates with your institution.',
  'examination-updates': 'Confirm results and examination notices on the official portal for your examination body.',
  'school-updates': 'Confirm campus-specific details with your institution.',
  general: 'Confirm details with the official source before acting on them.',
};

export function advisoryForCategory(category: string): string {
  return CATEGORY_ADVISORY[category] || CATEGORY_ADVISORY.general;
}

/** Attribution-first body: summary, advisory, and the source the claim came from. */
export function buildArticleBody(input: {
  excerpt: string | null;
  category: string;
  sourceName: string;
  sourceUrl: string;
}): string {
  const summary = normalizeWhitespace(input.excerpt || '');
  const parts = [
    summary || 'EduReach recorded this update from the source below.',
    advisoryForCategory(input.category),
    `Source: ${input.sourceName} — ${input.sourceUrl}`,
    'EduReach is an independent student-support platform and is not affiliated with any examination body, government agency or institution.',
  ];
  return parts.join('\n\n').trim();
}

export function passesSourceFilters(
  item: ParsedItem,
  source: SourceDefinition,
): { passed: boolean; reason?: string } {
  const url = item.url;
  const path = (() => {
    try {
      return new URL(url).pathname;
    } catch {
      return '';
    }
  })();

  if (source.pathInclude && !new RegExp(source.pathInclude, 'i').test(path)) {
    return { passed: false, reason: 'path_include' };
  }
  if (source.pathExclude && new RegExp(source.pathExclude, 'i').test(path)) {
    return { passed: false, reason: 'path_exclude' };
  }
  if (source.requiresAnyTitleTerm?.length) {
    const title = item.title.toLowerCase();
    if (!source.requiresAnyTitleTerm.some((term) => title.includes(term.toLowerCase()))) {
      return { passed: false, reason: 'title_filter' };
    }
  }
  return { passed: true };
}

function uniqueSlug(base: string, taken: Set<string>): string {
  const slug = slugify(base, 70);
  if (!taken.has(slug)) {
    taken.add(slug);
    return slug;
  }
  const suffix = `${Date.now().toString(36).slice(-3)}${Math.random().toString(36).slice(2, 5)}`;
  const candidate = `${slug.slice(0, 60)}-${suffix}`;
  taken.add(candidate);
  return candidate;
}

interface PreparedCandidate {
  indexEntry: IndexEntry;
  source: SourceDefinition;
  item: ParsedItem;
  canonicalUrl: string;
  category: string;
  relevance: number;
  qualityScore: number;
  qualityFlags: unknown;
  excerpt: string | null;
  body: string;
  status: 'published' | 'needs_review' | 'duplicate' | 'rejected';
  reason: string;
  autoPublish: boolean;
  dedupeKey: string;
  contentHash: string;
  publishedAt: string | null;
  reviewNotes: string | null;
}

/** Loads the dedupe index from existing articles and recent candidates. */
export async function loadDedupeIndex(
  supabase: NewsroomSupabase,
  lookbackDays: number,
): Promise<IndexEntry[]> {
  const since = new Date(Date.now() - lookbackDays * 86_400_000).toISOString();
  const entries: IndexEntry[] = [];

  const { data: articles, error: articleError } = await supabase
    .from('news_articles')
    .select('id,title,excerpt,source_key,source_url,dedupe_key,content_hash,source_published_at,created_at,published')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(800);
  if (articleError) throw articleError;

  for (const row of articles || []) {
    const canonical = canonicalUrl(String(row.source_url || '')) || `article:${row.id}`;
    entries.push(buildIndexEntry({
      id: row.id,
      origin: 'article',
      title: String(row.title || ''),
      canonicalUrl: canonical,
      excerpt: row.excerpt ? String(row.excerpt) : null,
      sourceKey: String(row.source_key || 'legacy'),
      sourcePublishedAt: row.source_published_at ? String(row.source_published_at) : null,
    }));
  }

  const { data: candidates, error: candidateError } = await supabase
    .from('news_ingest_candidates')
    .select('id,title,excerpt,source_key,canonical_url,content_hash,source_published_at,status')
    .gte('created_at', since)
    .in('status', ['new', 'needs_review', 'approved', 'published', 'duplicate'])
    .order('created_at', { ascending: false })
    .limit(600);
  // Older databases may not have the pipeline tables yet; treat that as "no
  // candidates known" rather than failing the run.
  if (!candidateError) {
    for (const row of candidates || []) {
      entries.push(buildIndexEntry({
        id: row.id,
        origin: 'candidate',
        title: String(row.title || ''),
        canonicalUrl: String(row.canonical_url || ''),
        excerpt: row.excerpt ? String(row.excerpt) : null,
        sourceKey: String(row.source_key || ''),
        sourcePublishedAt: row.source_published_at ? String(row.source_published_at) : null,
      }));
    }
  }

  return entries;
}

/**
 * Keeps the code catalogue and the database registry in step. Catalogue fields
 * always win for identity (name, homepage, tier); operational fields are only
 * written while the row is still code-managed, so an operator override sticks.
 */
export async function syncSourceRegistry(
  supabase: NewsroomSupabase,
  definitions: SourceDefinition[],
): Promise<SourceDefinition[]> {
  const { data: rows, error } = await supabase
    .from('news_sources')
    .select('source_key,name,homepage,feed_url,tier,discovery,category_hint,trust_score,is_managed,is_active,notes');
  if (error) throw error;

  const existing = new Map<string, any>((rows || []).map((row: any) => [row.source_key, row]));
  const merged: SourceDefinition[] = [];
  const nowIso = new Date().toISOString();

  for (const definition of definitions) {
    const row = existing.get(definition.sourceKey);
    if (!row) {
      const { error: insertError } = await supabase.from('news_sources').insert({
        source_key: definition.sourceKey,
        name: definition.name,
        homepage: definition.homepage,
        feed_url: definition.feedUrl ?? null,
        tier: definition.tier,
        discovery: definition.discovery ?? 'auto',
        category_hint: definition.categoryHint ?? null,
        trust_score: definition.trustScore,
        is_active: definition.isActive !== false,
        is_managed: true,
        notes: definition.notes ?? null,
        updated_at: nowIso,
      });
      if (insertError) throw insertError;
      merged.push(definition);
      continue;
    }

    const managed = row.is_managed !== false;
    const patch: Record<string, unknown> = {
      name: definition.name,
      homepage: definition.homepage,
      tier: definition.tier,
      category_hint: definition.categoryHint ?? null,
      trust_score: definition.trustScore,
      updated_at: nowIso,
    };
    if (managed) {
      patch.feed_url = definition.feedUrl ?? null;
      patch.discovery = definition.discovery ?? 'auto';
      patch.is_active = definition.isActive !== false;
      if (definition.notes) patch.notes = definition.notes;
    }
    const { error: updateError } = await supabase.from('news_sources').update(patch).eq('source_key', definition.sourceKey);
    if (updateError) throw updateError;

    merged.push(sourceFromRegistryRow({ ...row, ...patch }));
  }

  // Operator-added sources (not in the code catalogue) are used as they are.
  for (const row of rows || []) {
    if (definitions.some((definition) => definition.sourceKey === row.source_key)) continue;
    merged.push(sourceFromRegistryRow(row));
  }

  return merged.filter((source) => source.isActive !== false);
}

function feedItemsFrom(result: { text: string; contentType: string }, url: string): ParsedItem[] {
  const trimmed = result.text.trimStart();
  if (trimmed.startsWith('{')) {
    try {
      return parseJsonFeed(JSON.parse(trimmed), url);
    } catch {
      return [];
    }
  }
  return parseFeed(result.text, url);
}

async function discoverForSource(
  source: SourceDefinition,
  context: {
    robots: RobotsCache;
    throttle: HostThrottle;
    userAgent: string;
    fetchImpl?: typeof fetch;
    maxItems: number;
    maxPageFetches: number;
  },
  log: (message: string, meta?: Record<string, unknown>) => void,
): Promise<ParsedItem[]> {
  const target = source.feedUrl || source.homepage;
  const result = await politeFetch(target, context);
  if (!result.ok) {
    // A source with a broken feed but a working homepage still gets discovered.
    if (source.feedUrl && source.homepage && source.discovery !== 'rss') {
      log(`feed failed for ${source.sourceKey}; falling back to HTML discovery`, { error: result.error });
      const fallback = await politeFetch(source.homepage, context);
      if (fallback.ok) return itemsFromHtml(fallback.text, source.homepage, context);
      // Both paths failed: record the original failure so it is visible in the
      // run report and in news_sources health instead of silently reporting zero.
      throw new Error(result.error || fallback.error || 'source fetch failed');
    }
    throw new Error(result.error || 'source fetch failed');
  }

  if (looksLikeFeed(result)) {
    const items = feedItemsFrom(result, result.finalUrl || target);
    if (items.length) return items.slice(0, context.maxItems);
    if (source.discovery === 'rss') return [];
  }

  return itemsFromHtml(result.text, result.finalUrl || source.homepage, context);
}

async function itemsFromHtml(
  html: string,
  pageUrl: string,
  context: { robots: RobotsCache; throttle: HostThrottle; userAgent: string; fetchImpl?: typeof fetch; maxItems: number; maxPageFetches: number },
): Promise<ParsedItem[]> {
  const links = discoverArticleLinks(html, pageUrl, context.maxPageFetches);
  const items: ParsedItem[] = [];

  for (const link of links) {
    if (items.length >= context.maxItems) break;
    const page = await politeFetch(link, context);
    if (!page.skipped && !page.ok) continue;
    if (!page.ok) continue;
    const meta = extractPageMeta(page.text, link);
    const title = meta.title || normalizeWhitespace((page.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ''));
    if (!title) continue;
    items.push({
      title: toPlainText(title, 200),
      url: link,
      excerpt: meta.description,
      imageUrl: meta.imageUrl,
      publishedAt: meta.publishedAt,
      categories: [],
      author: null,
    });
  }

  return items;
}

export async function runIngestion(
  supabase: NewsroomSupabase,
  options: IngestOptions = {},
): Promise<IngestReport> {
  const settings = { ...DEFAULTS, ...options };
  const now = options.now ?? (() => new Date());
  const startedAt = now().toISOString();
  const log = options.log ?? (() => {});
  const userAgent = options.userAgent || undefined;
  const context = {
    robots: new RobotsCache(userAgent || 'EduReach-Newsroom/1.0', { fetchImpl: options.fetchImpl }),
    throttle: new HostThrottle(1000),
    userAgent: userAgent || 'EduReach-Newsroom/1.0',
    fetchImpl: options.fetchImpl,
  };

  const errors: string[] = [];
  let runId: string | null = null;

  if (!options.dryRun) {
    const { data, error } = await supabase.from('news_ingest_runs').insert({
      triggered_by: options.triggeredBy ?? 'schedule',
      dry_run: false,
    }).select('id').single();
    if (error) throw error;
    runId = data?.id ?? null;
  }

  // 1. Registry -----------------------------------------------------------
  let sources: SourceDefinition[];
  try {
    sources = options.sources
      ? options.sources
      : options.dryRun
        ? DEFAULT_SOURCES.filter((source) => source.isActive !== false)
        : await syncSourceRegistry(supabase, DEFAULT_SOURCES);
  } catch (error) {
    const message = `source registry unavailable: ${error instanceof Error ? error.message : String(error)}`;
    errors.push(message);
    sources = DEFAULT_SOURCES.filter((source) => source.isActive !== false);
  }

  // 2. Known ground truth for dedupe --------------------------------------
  let index: IndexEntry[] = [];
  try {
    index = await loadDedupeIndex(supabase, settings.lookbackDays);
  } catch (error) {
    errors.push(`dedupe index unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }

  // 3. Discover ------------------------------------------------------------
  const perSource: SourceOutcome[] = [];
  const collected: Array<{ source: SourceDefinition; item: ParsedItem }> = [];
  const queue = [...sources];

  async function worker() {
    while (queue.length) {
      const source = queue.shift();
      if (!source) continue;
      const sourceStarted = Date.now();
      try {
        const items = await discoverForSource(source, {
          robots: context.robots,
          throttle: context.throttle,
          userAgent: context.userAgent,
          fetchImpl: options.fetchImpl,
          maxItems: settings.maxItemsPerSource,
          maxPageFetches: settings.maxPageFetchesPerSource,
        }, log);
        collected.push(...items.map((item) => ({ source, item })));
        perSource.push({
          sourceKey: source.sourceKey,
          status: 'ok',
          items: items.length,
          candidates: 0,
          durationMs: Date.now() - sourceStarted,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${source.sourceKey}: ${message}`);
        perSource.push({
          sourceKey: source.sourceKey,
          status: 'failed',
          items: 0,
          candidates: 0,
          error: message,
          durationMs: Date.now() - sourceStarted,
        });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, settings.concurrency) }, () => worker()));

  // 4. Classify, deduplicate, gate ----------------------------------------
  const batchIndex: IndexEntry[] = [];
  const prepared: PreparedCandidate[] = [];
  const decisions: IngestDecision[] = [];
  const seenThisRun = new Set<string>();

  const knownSlugs = options.dryRun ? new Set<string>() : await (async () => {
    try {
      const { data } = await supabase.from('news_articles').select('slug').limit(2000);
      return new Set<string>((data || []).map((row: any) => String(row.slug)));
    } catch {
      return new Set<string>();
    }
  })();

  for (const { source, item } of collected.slice(0, settings.maxCandidates)) {
    const record = (status: IngestDecision['status'], reason: string, category = 'general') => {
      decisions.push({ title: item.title, sourceKey: source.sourceKey, status, reason, category, url: item.url });
    };

    const filter = passesSourceFilters(item, source);
    if (!filter.passed) {
      record('rejected', filter.reason || 'source_filter');
      continue;
    }

    const canonical = canonicalUrl(item.url, source.homepage);
    if (!canonical) {
      record('rejected', 'invalid_url');
      continue;
    }
    if (seenThisRun.has(canonical)) {
      record('duplicate', 'same_run_url');
      continue;
    }
    seenThisRun.add(canonical);

    const classification = classify({
      title: item.title,
      excerpt: item.excerpt,
      sourceTier: source.tier,
      trustScore: source.trustScore,
      categoryHint: source.categoryHint,
    }, {
      relevanceThreshold: options.relevanceThreshold,
      autoPublishThreshold: options.autoPublishThreshold,
    });

    if (!classification.relevant) {
      record('rejected', `low_relevance:${classification.score}`, classification.category);
      continue;
    }

    const excerpt = item.excerpt ? truncate(toPlainText(item.excerpt, 600), 400) : null;
    const body = buildArticleBody({
      excerpt,
      category: classification.category,
      sourceName: source.name,
      sourceUrl: canonical,
    });

    const gate = runQualityGate({
      title: item.title,
      excerpt,
      body,
      category: classification.category,
      sourceUrl: canonical,
      sourceName: source.name,
      imageUrl: item.imageUrl,
      publishedAt: item.publishedAt,
      sourceTier: source.tier,
      relevanceScore: classification.score,
    });

    if (!gate.passed) {
      record('rejected', `quality_gate:${gate.errors[0] || 'failed'}`, classification.category);
      continue;
    }

    const indexEntry = buildIndexEntry({
      title: item.title,
      canonicalUrl: canonical,
      excerpt,
      body,
      sourceKey: source.sourceKey,
      sourcePublishedAt: item.publishedAt,
      origin: 'batch',
    });

    const match = findDuplicate(indexEntry, [...index, ...batchIndex]);
    const possibleDuplicate = match?.level === 'possible';

    if (match && match.level !== 'possible') {
      record('duplicate', match.reason, classification.category);
      continue;
    }

    const autoPublish = classification.autoPublishEligible && !possibleDuplicate;
    const hasRunDate = Boolean(item.publishedAt);
    let status: PreparedCandidate['status'] = autoPublish ? 'published' : 'needs_review';
    let reason = classification.reason;
    if (possibleDuplicate) {
      reason = `possible duplicate flagged for review: ${match?.reason}`;
    } else if (autoPublish && !hasRunDate) {
      // Without a source date we cannot compute a reliable expiry, so a human
      // confirms it instead of the pipeline guessing.
      status = 'needs_review';
      reason = 'missing source publication date';
    }
    if (gate.warnings.length && status === 'published') {
      status = 'needs_review';
      reason = `quality warning: ${gate.warnings[0]}`;
    }

    batchIndex.push(indexEntry);

    prepared.push({
      indexEntry,
      source,
      item,
      canonicalUrl: canonical,
      category: classification.category,
      relevance: classification.score,
      qualityScore: gate.score,
      qualityFlags: [...gate.flags, ...(match ? [{ code: 'possible_duplicate', level: 'warning', message: describeMatch(match) }] : [])],
      excerpt,
      body,
      status,
      reason,
      autoPublish: status === 'published',
      dedupeKey: dedupeKeyFor({ canonicalUrl: canonical, title: item.title }),
      contentHash: contentHash(item.title, body),
      publishedAt: item.publishedAt,
      reviewNotes: match ? describeMatch(match) : null,
    });
    record(status, reason, classification.category);
  }

  // 5. Persist -------------------------------------------------------------
  let published = 0;
  let needsReview = 0;
  let duplicates = decisions.filter((decision) => decision.status === 'duplicate').length;
  let rejected = decisions.filter((decision) => decision.status === 'rejected').length;

  if (!options.dryRun && prepared.length) {
    const insertedIds = new Map<PreparedCandidate, string>();

    for (let start = 0; start < prepared.length; start += 100) {
      const chunk = prepared.slice(start, start + 100);
      const rows = chunk.map((entry) => ({
        run_id: runId,
        source_key: entry.source.sourceKey,
        source_name: entry.source.name,
        source_tier: entry.source.tier,
        source_url: entry.canonicalUrl,
        canonical_url: entry.canonicalUrl,
        title: entry.item.title,
        excerpt: entry.excerpt,
        body: entry.body,
        image_url: entry.item.imageUrl || null,
        category: entry.category,
        source_published_at: entry.publishedAt,
        content_hash: entry.contentHash || null,
        dedupe_key: entry.dedupeKey,
        relevance_score: entry.relevance,
        quality_score: entry.qualityScore,
        quality_flags: entry.qualityFlags,
        review_notes: entry.reviewNotes,
        status: 'new',
      }));

      const { data, error } = await supabase.from('news_ingest_candidates').insert(rows).select('id');
      if (error) {
        errors.push(`candidate insert failed: ${error.message}`);
        continue;
      }
      (data || []).forEach((row: any, position: number) => {
        if (chunk[position]) insertedIds.set(chunk[position], row.id);
      });
    }

    const nowIso = now().toISOString();

    for (const entry of prepared) {
      const candidateId = insertedIds.get(entry) || null;

      if (entry.status === 'published') {
        const publishedAt = entry.publishedAt || nowIso;
        const articleRow = {
          slug: uniqueSlug(entry.item.title, knownSlugs),
          title: entry.item.title,
          excerpt: entry.excerpt,
          body: entry.body,
          category: entry.category,
          image_url: entry.item.imageUrl || null,
          source_name: entry.source.name,
          source_url: entry.canonicalUrl,
          published: true,
          published_at: publishedAt,
          featured: false,
          tags: entry.category,
          source_key: entry.source.sourceKey,
          source_tier: entry.source.tier,
          source_published_at: entry.publishedAt,
          last_verified_at: nowIso,
          verification_status: 'verified',
          expires_at: expiresAtFor(entry.category, new Date(publishedAt)),
          content_hash: entry.contentHash || null,
          dedupe_key: entry.dedupeKey,
          ingest_candidate_id: candidateId,
          review_status: entry.source.tier === 1 ? 'auto_published' : 'editor_approved',
        };

        const { data, error } = await supabase.from('news_articles').insert(articleRow).select('id').single();
        if (error) {
          // 23505 on dedupe_key means another run published it first; that is a
          // duplicate, not a failure.
          if (String(error.code) === '23505') {
            duplicates += 1;
            if (candidateId) {
              await supabase.from('news_ingest_candidates')
                .update({ status: 'duplicate', rejection_reason: 'dedupe_key_conflict', updated_at: nowIso })
                .eq('id', candidateId);
            }
            continue;
          }
          errors.push(`article insert failed for "${entry.item.title.slice(0, 60)}": ${error.message}`);
          if (candidateId) {
            await supabase.from('news_ingest_candidates')
              .update({ status: 'failed', rejection_reason: error.message, updated_at: nowIso })
              .eq('id', candidateId);
          }
          continue;
        }

        published += 1;
        if (candidateId) {
          await supabase.from('news_ingest_candidates')
            .update({ status: 'published', article_id: data?.id ?? null, updated_at: nowIso })
            .eq('id', candidateId);
        }
        continue;
      }

      needsReview += 1;
      if (candidateId) {
        await supabase.from('news_ingest_candidates')
          .update({
            status: 'needs_review',
            review_notes: entry.reviewNotes || entry.reason,
            updated_at: nowIso,
          })
          .eq('id', candidateId);
      }
    }
  } else {
    published = prepared.filter((entry) => entry.status === 'published').length;
    needsReview = prepared.filter((entry) => entry.status === 'needs_review').length;
  }

  // Rejected and duplicate discoveries are recorded as candidates too, so the
  // newsroom can show "what we saw and why we skipped it".
  if (!options.dryRun) {
    const decided = decisions.filter((decision) => decision.status === 'rejected' || decision.status === 'duplicate');
    if (decided.length) {
      const rows = decided.slice(0, 200).map((decision) => ({
        run_id: runId,
        source_key: decision.sourceKey,
        source_name: sources.find((source) => source.sourceKey === decision.sourceKey)?.name || decision.sourceKey,
        source_tier: sources.find((source) => source.sourceKey === decision.sourceKey)?.tier || 3,
        source_url: decision.url,
        canonical_url: canonicalUrl(decision.url) || decision.url,
        title: decision.title.slice(0, 300),
        category: decision.category,
        status: decision.status,
        rejection_reason: decision.reason,
        dedupe_key: dedupeKeyFor({ canonicalUrl: canonicalUrl(decision.url) || decision.url, title: decision.title }),
      }));
      const { error } = await supabase.from('news_ingest_candidates').insert(rows);
      if (error) errors.push(`skipped-item log failed: ${error.message}`);
    }
  }

  // 6. Housekeeping --------------------------------------------------------
  let expired = 0;
  let imagesRepaired = 0;

  if (!options.dryRun) {
    const { data: expiredCount, error: expireError } = await supabase.rpc('expire_stale_news');
    if (expireError) errors.push(`news expiry sweep failed: ${expireError.message}`);
    else expired = Number(expiredCount || 0);

    const { error: opportunityError } = await supabase.rpc('close_expired_opportunities');
    if (opportunityError) errors.push(`opportunity expiry sweep failed: ${opportunityError.message}`);

    if (options.repairImages !== false) {
      try {
        imagesRepaired = await repairMissingImages(supabase, {
          fetchImpl: options.fetchImpl,
          robots: context.robots,
          throttle: context.throttle,
          userAgent: context.userAgent,
        });
      } catch (error) {
        errors.push(`image repair failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  const finishedAt = now().toISOString();
  const report: IngestReport = {
    runId,
    startedAt,
    finishedAt,
    dryRun: Boolean(options.dryRun),
    triggeredBy: options.triggeredBy ?? 'schedule',
    sourcesChecked: sources.length,
    sourcesFailed: perSource.filter((source) => source.status === 'failed').length,
    candidatesFound: collected.length,
    duplicates,
    rejected,
    needsReview,
    published,
    imagesRepaired,
    expired,
    perSource: perSource.sort((a, b) => a.sourceKey.localeCompare(b.sourceKey)),
    decisions: decisions.slice(0, 200),
    errors,
  };

  if (!options.dryRun && runId) {
    const { error } = await supabase.from('news_ingest_runs').update({
      finished_at: finishedAt,
      status: errors.length === 0 ? 'succeeded' : errors.length >= 3 ? 'failed' : 'partial',
      sources_checked: report.sourcesChecked,
      sources_failed: report.sourcesFailed,
      candidates_found: report.candidatesFound,
      duplicates: report.duplicates,
      rejected: report.rejected,
      needs_review: report.needsReview,
      published: report.published,
      images_repaired: report.imagesRepaired,
      expired: report.expired,
      report: {
        perSource: report.perSource,
        errors: report.errors.slice(0, 20),
        newsroom: report.decisions.slice(0, 100),
      },
    }).eq('id', runId);
    if (error) errors.push(`run report update failed: ${error.message}`);
  }

  return report;
}

/**
 * Fills in missing article images from the source page. This is the original
 * behaviour of the daily function, preserved as one step of the larger run.
 */
export async function repairMissingImages(
  supabase: NewsroomSupabase,
  context: {
    fetchImpl?: typeof fetch;
    robots: RobotsCache;
    throttle: HostThrottle;
    userAgent: string;
    limit?: number;
  },
): Promise<number> {
  const { data: articles, error } = await supabase
    .from('news_articles')
    .select('id,title,source_url,image_url')
    .eq('published', true)
    .or('image_url.is.null,image_url.eq.')
    .not('source_url', 'is', null)
    .limit(context.limit ?? 25);
  if (error) throw error;

  let repaired = 0;
  for (const article of articles || []) {
    const sourceUrl = String(article.source_url || '');
    if (!sourceUrl || hostOf(sourceUrl) === '') continue;
    const page = await politeFetch(sourceUrl, context);
    if (!page.ok) continue;
    const meta = extractPageMeta(page.text, sourceUrl);
    if (!meta.imageUrl) continue;
    const { error: updateError } = await supabase
      .from('news_articles')
      .update({ image_url: meta.imageUrl, updated_at: new Date().toISOString() })
      .eq('id', article.id)
      .is('image_url', null);
    if (!updateError) repaired += 1;
  }

  return repaired;
}
