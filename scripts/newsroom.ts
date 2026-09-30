/**
 * Newsroom operator CLI.
 *
 *   npm run newsroom:run            # one real ingestion run
 *   npm run newsroom:run -- --dry-run
 *   npm run newsroom:check          # probe every source, record health, no writes
 *   npm run newsroom:integrity      # print the content integrity report
 *
 * `--check-sources` is the production-enablement step for the source registry:
 * it proves which official sites and feed paths actually resolve from the
 * deployment network, and records the result in news_sources so nobody has to
 * trust a hardcoded assumption about a feed URL.
 */

import 'dotenv/config';
import { HostThrottle, RobotsCache, looksLikeFeed, politeFetch } from '../src/server/newsroom/fetch';
import { parseFeed, parseJsonFeed } from '../src/server/newsroom/parse';
import { createNewsroomClient, runNewsroomRefresh, summarizeRun } from '../src/server/newsroom/run';
import type { NewsroomSupabase } from '../src/server/newsroom/pipeline';
import { DEFAULT_SOURCES } from '../src/server/newsroom/sources';

const args = process.argv.slice(2);
const hasFlag = (name: string) => args.includes(name);
const flagValue = (name: string): string | null => {
  const match = args.find((arg) => arg.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
};

function pad(value: string, width: number): string {
  return value.length > width ? `${value.slice(0, width - 1)}…` : value.padEnd(width);
}

async function checkSources(): Promise<void> {
  const robots = new RobotsCache('EduReach-Newsroom/1.0');
  const throttle = new HostThrottle(1200);
  let client: NewsroomSupabase | null = null;
  try {
    client = createNewsroomClient();
  } catch {
    console.warn('Supabase is not configured; health results will not be recorded.\n');
  }

  console.log(`${pad('SOURCE', 32)}${pad('TIER', 5)}${pad('TARGET', 10)}${pad('STATUS', 10)}${pad('ITEMS', 7)}MS`);
  const failures: string[] = [];

  for (const source of DEFAULT_SOURCES) {
    const target = source.feedUrl || source.homepage;
    const started = Date.now();
    const result = await politeFetch(target, { robots, throttle, userAgent: 'EduReach-Newsroom/1.0' });
    let items = 0;
    if (result.ok) {
      if (looksLikeFeed(result)) {
        const parsed = result.text.trimStart().startsWith('{')
          ? parseJsonFeed((() => { try { return JSON.parse(result.text); } catch { return null; } })(), target)
          : parseFeed(result.text, target);
        items = parsed.length;
      }
    }
    const duration = Date.now() - started;
    const status = result.ok ? (items > 0 || !source.feedUrl ? 'ok' : 'empty-feed') : (result.error || 'failed');
    if (!result.ok) failures.push(`${source.sourceKey}: ${result.error}`);

    console.log(`${pad(source.sourceKey, 32)}${pad(String(source.tier), 5)}${pad(source.feedUrl ? 'rss' : 'html', 10)}${pad(String(status).slice(0, 9), 10)}${pad(String(items), 7)}${duration}`);

    if (client) {
      try {
        await client.from('news_sources').update({
          last_checked_at: new Date().toISOString(),
          last_status: result.ok ? `ok:${items}` : String(result.error || 'failed'),
          last_error: result.ok ? null : String(result.error || 'failed'),
          updated_at: new Date().toISOString(),
        }).eq('source_key', source.sourceKey);
      } catch {
        // The registry table may not exist yet; the report above is still useful.
      }
    }
  }

  console.log('');
  if (failures.length) {
    console.log(`${failures.length} source(s) unreachable from this network:`);
    for (const failure of failures) console.log(`  - ${failure}`);
    console.log('\nSources that fail here will also fail in production. Fix the feed path in the');
    console.log('news_sources table (set is_managed = false) or leave them to HTML discovery.');
  } else {
    console.log('Every configured source responded.');
  }
}

async function integrity(): Promise<void> {
  const client = createNewsroomClient();
  const { data, error } = await client.rpc('content_integrity_report');
  if (error) {
    console.error(`Integrity report unavailable: ${error.message}`);
    console.error('Apply supabase/migrations/20260930120000_newsroom_ingestion_pipeline.sql first.');
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify(data, null, 2));
}

async function main(): Promise<void> {
  if (hasFlag('--check-sources')) return checkSources();
  if (hasFlag('--integrity')) return integrity();

  const dryRun = hasFlag('--dry-run');
  const report = await runNewsroomRefresh({
    triggeredBy: 'cli',
    dryRun,
    repairImages: !hasFlag('--skip-images'),
    maxItemsPerSource: Number(flagValue('--limit')) || undefined,
    log: (message, meta) => console.log(`  · ${message}`, meta ? JSON.stringify(meta) : ''),
  });

  console.log(`\nEduReach newsroom run ${report.runId ?? '(dry run)'}`);
  console.log('-----------------------------------------');
  console.log(`sources checked     ${report.sourcesChecked - report.sourcesFailed}/${report.sourcesChecked}`);
  console.log(`candidates found    ${report.candidatesFound}`);
  console.log(`duplicates           ${report.duplicates}`);
  console.log(`rejected             ${report.rejected}`);
  console.log(`needs review         ${report.needsReview}`);
  console.log(`published            ${report.published}`);
  console.log(`images repaired      ${report.imagesRepaired}`);
  console.log(`expired              ${report.expired}`);
  console.log(`errors               ${report.errors.length}`);
  console.log('-----------------------------------------');
  console.log(summarizeRun(report));

  if (report.perSource.some((source) => source.status === 'failed')) {
    console.log('\nFailed sources:');
    for (const source of report.perSource.filter((entry) => entry.status === 'failed')) {
      console.log(`  - ${source.sourceKey}: ${source.error}`);
    }
  }

  const published = report.decisions.filter((decision) => decision.status === 'published');
  if (published.length) {
    console.log('\nPublished:');
    for (const decision of published.slice(0, 20)) console.log(`  + [${decision.category}] ${decision.title}`);
  }
  const review = report.decisions.filter((decision) => decision.status === 'needs_review');
  if (review.length) {
    console.log('\nQueued for review:');
    for (const decision of review.slice(0, 20)) console.log(`  ? [${decision.category}] ${decision.title} (${decision.reason})`);
  }

  if (report.errors.length) {
    console.log('\nErrors:');
    for (const error of report.errors.slice(0, 20)) console.log(`  ! ${error}`);
  }
}

main().catch((error) => {
  // Configuration and network problems are operator messages, not stack traces.
  console.error(`\nNewsroom CLI failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
