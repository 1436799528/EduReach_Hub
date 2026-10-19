/**
 * Duplicate audit for exam_questions — exact and near-duplicate analysis.
 *
 * Priority 4: Run exact and near-duplicate analysis against the actual
 * question database when authorised access is available. Do not delete
 * questions based on text similarity alone.
 *
 * This script is read-only and safe to run on production. It never deletes.
 * When SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not set, it reports
 * BLOCKED (missing credentials) and exits 0 so CI stays green but does not
 * overclaim. When credentials are present, it prints exact-duplicate groups
 * and near-duplicate candidates for manual review. Exact duplicate coverage is
 * limited to the first 20,000 rows returned by Supabase; near-duplicate analysis
 * is explicitly a sample of the first 200 rows (19,900 maximum pairs), not a
 * full-bank near-duplicate audit.
 *
 * Usage:
 *   npm run duplicate:audit          # requires env
 *   npx tsx scripts/duplicate-audit.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

async function run() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.log('BLOCKED: SUPABASE_URL or SERVICE_ROLE_KEY not set — cannot query production question database.');
    console.log('Exact and near-duplicate analysis requires authorised read access.');
    console.log('No questions were examined or deleted.');
    console.log('To run locally with PGlite replay: npm run schema:audit and inspect exam_questions via PGlite.');
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

  // Exact duplicates: same normalized question_text across any exams
  const { data, error } = await supabase
    .from('exam_questions')
    .select('id, exam_id, subject, question_text')
    .limit(20000);

  if (error) {
    console.error('Failed to fetch exam_questions:', error.message);
    process.exit(1);
  }

  const byNorm = new Map<string, typeof data>();
  for (const row of data || []) {
    const key = normalize(row.question_text);
    const list = byNorm.get(key) || [];
    list.push(row);
    byNorm.set(key, list);
  }

  const exactGroups = [...byNorm.entries()].filter(([, list]) => list.length > 1);
  console.log(`Questions examined for exact duplicates: ${data?.length} (query cap: 20,000; larger banks may be truncated)`);
  console.log(`Exact duplicate groups (normalized text identical): ${exactGroups.length}`);
  for (const [norm, list] of exactGroups.slice(0, 20)) {
    console.log(`  - "${norm.slice(0, 80)}" ×${list.length} [${list.map((r) => `${r.exam_id}:${r.subject}`).join(', ')}]`);
  }
  if (exactGroups.length > 20) console.log(`  ... and ${exactGroups.length - 20} more exact groups`);

  // Near-duplicate: token-set Jaccard (not trigram similarity), threshold 0.85.
  // SAMPLE ONLY: first 200 rows, at most 19,900 pair comparisons. Not a full audit.
  // Never used for deletion — manual review required.
  const candidates: Array<{ a: string; b: string; similarity: number }> = [];
  const rows = data || [];
  // Limit to 500 comparisons for performance in this example
  for (let i = 0; i < Math.min(rows.length, 200); i++) {
    for (let j = i + 1; j < Math.min(rows.length, 200); j++) {
      const a = normalize(rows[i].question_text);
      const b = normalize(rows[j].question_text);
      if (a === b) continue;
      const setA = new Set(a.split(' ').filter(Boolean));
      const setB = new Set(b.split(' ').filter(Boolean));
      const inter = [...setA].filter((x) => setB.has(x)).length;
      const union = new Set([...setA, ...setB]).size;
      const jaccard = union ? inter / union : 0;
      if (jaccard >= 0.85) candidates.push({ a: rows[i].question_text.slice(0, 60), b: rows[j].question_text.slice(0, 60), similarity: jaccard });
    }
  }
  console.log(`Near-duplicate SAMPLE only (token Jaccard >= 0.85; first 200 rows / at most 19,900 pairs): ${candidates.length} candidates`);
  for (const c of candidates.slice(0, 10)) {
    console.log(`  ~ ${c.similarity.toFixed(2)} "${c.a}" ↔ "${c.b}"`);
  }
  console.log('No deletions performed. Review exact groups manually; near-duplicates require editorial decision.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
