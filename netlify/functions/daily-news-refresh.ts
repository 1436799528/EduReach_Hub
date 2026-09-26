import { createClient } from '@supabase/supabase-js';

type NetlifyEnv = { get(name: string): string | undefined };
type NetlifyGlobal = { env: NetlifyEnv };
const netlify = (globalThis as typeof globalThis & { Netlify?: NetlifyGlobal }).Netlify;

const FETCH_TIMEOUT_MS = 5000;
const MAX_HTML_BYTES = 700_000;
const CONCURRENCY = 4;

function env(name: string): string {
  const value = netlify?.env.get(name) ?? process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function extractImage(html: string, sourceUrl: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["'][^>]*>/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["'][^>]*>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match?.[1]) continue;
    try {
      const image = new URL(decodeHtml(match[1].trim()), sourceUrl);
      if (image.protocol === 'http:' || image.protocol === 'https:') return image.toString();
    } catch {
      // Try the next metadata form.
    }
  }
  return null;
}

async function fetchHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'EduReach-NewsRefresh/1.0 (+https://edureachhub.netlify.app)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) return null;
    const text = await response.text();
    return text.slice(0, MAX_HTML_BYTES);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function runRefresh() {
  const supabase = createClient(env('VITE_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: articles, error } = await supabase
    .from('news_articles')
    .select('id,title,source_url,image_url')
    .eq('published', true)
    .or('image_url.is.null,image_url.eq.')
    .not('source_url', 'is', null)
    .limit(50);

  if (error) throw error;

  const queue = [...(articles || [])];
  let repaired = 0;
  let failed = 0;

  async function worker() {
    while (queue.length) {
      const article = queue.shift();
      if (!article?.source_url) continue;
      const html = await fetchHtml(article.source_url);
      const imageUrl = html ? extractImage(html, article.source_url) : null;
      if (!imageUrl) {
        failed += 1;
        continue;
      }

      const { error: updateError } = await supabase
        .from('news_articles')
        .update({ image_url: imageUrl, updated_at: new Date().toISOString() })
        .eq('id', article.id)
        .is('image_url', null);

      if (updateError) {
        failed += 1;
      } else {
        repaired += 1;
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  return { checked: articles?.length || 0, repaired, failed };
}

export default async () => {
  try {
    const result = await runRefresh();
    console.log('EduReach daily news image refresh:', result);
  } catch (error) {
    console.error('EduReach daily news image refresh failed:', error);
  }
};

export const config = {
  schedule: '@daily',
};
