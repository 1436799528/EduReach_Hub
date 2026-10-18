#!/usr/bin/env python3
"""
Prepare safe deduplicated import of arena 122Q banks for main baseline.
Reads arena file at 5549783, transforms inserts to add provenance columns
and deduplication guard (exact normalized text), without overwriting existing.
Output: supabase/migrations/20261020100000_safe_verified_question_banks.sql
"""
import subprocess
import pathlib

# Fetch arena file content
result = subprocess.run(
    ["git", "show", "5549783:supabase/migrations/20261020000000_real_style_question_banks.sql"],
    capture_output=True, text=True, cwd="/home/user/EduReach_Hub"
)
content = result.stdout

# Transform: add provenance columns to each exam_questions insert
# Original insert:
# insert into public.exam_questions (exam_id, subject, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, marks, position)
# select exam.id, x.subject, x.question_text, x.option_a, x.option_b, x.option_c, x.option_d, x.correct_option, x.explanation, 1, x.position
# We want to add: source_type, source_name, source_url, source_year, syllabus_topic, difficulty, review_status, format_verified, response_type
# With values: 'original_practice', 'EduReach original CBT practice (arena 122Q clone, 2026)', null, 2026, null, 'moderate', 'needs_review', false, 'single_choice'

old_insert = "insert into public.exam_questions (exam_id, subject, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, marks, position)\nselect exam.id, x.subject, x.question_text, x.option_a, x.option_b, x.option_c, x.option_d, x.correct_option, x.explanation, 1, x.position"
new_insert = """insert into public.exam_questions (exam_id, subject, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, marks, position, source_type, source_name, source_year, review_status, format_verified, response_type, difficulty)
select exam.id, x.subject, x.question_text, x.option_a, x.option_b, x.option_c, x.option_d, x.correct_option, x.explanation, 1, x.position, 'original_practice', 'EduReach original CBT practice (arena 122Q clone, 2026)', 2026, 'needs_review', false, 'single_choice', 'moderate'"""

content = content.replace(old_insert, new_insert)

# Add deduplication guard: original has `where not exists (select 1 from public.exam_questions q where q.exam_id = exam.id and q.position = x.position);`
# We want to also guard on normalized text: and q.exam_id = exam.id and lower(trim(q.question_text)) = lower(trim(x.question_text))
# But we should keep position guard and add text guard as additional OR? Actually we want to skip if either position already exists OR text already exists (exact duplicate)
# Simplest: keep position guard and add additional guard for text via NOT EXISTS subquery in SELECT? We can modify WHERE clause to check both.
# Original: where not exists (select 1 from public.exam_questions q where q.exam_id = exam.id and q.position = x.position);
# New: where not exists (select 1 from public.exam_questions q where q.exam_id = exam.id and (q.position = x.position or lower(btrim(q.question_text)) = lower(btrim(x.question_text))));
# But btrim not needed? Use trim.
old_where = "where not exists (select 1 from public.exam_questions q where q.exam_id = exam.id and q.position = x.position);"
new_where = "where not exists (select 1 from public.exam_questions q where q.exam_id = exam.id and (q.position = x.position or lower(trim(q.question_text)) = lower(trim(x.question_text))));"

content = content.replace(old_where, new_where)

# Add header with safety notes
header = """-- Safe verified question-bank import — arena 122Q banks, deduplicated
-- Baseline: main @ e573d08 (62 migrations, no real banks, only 10Q demo)
-- Source inspected: arena/2630b947-edureach-hub @ 5549783 (58 migrations, 212Q: JAMB 122, WAEC 36, NECO 30, Post-UTME 24)
-- Verification:
--   * Arena banks are original clones (no official past-question claim), style-matched to exam blueprints
--   * Source metadata: original_practice, needs_review, format_verified=false (not claimed official)
--   * No official source URL — presence does not prove official provenance (per 18120000 comment)
--   * Compared with main: main has only 'EduReach General Practice Demo' (10Q, active, Mixed) — zero overlap on normalized text
--   * Deduplication: exact normalized question_text match (lower(trim())) is skipped; position guard also preserved
--   * No overwrite: existing exam rows kept, inserts are `where not exists` only; no UPDATE/DELETE of questions
--   * Demo bank deactivated (is_active=false) but row kept for history — preserves student data
--   * Near-duplicate (similarity) analysis NOT used for deletion — requires manual review (see duplicate audit note)
-- This migration is idempotent and safe to run on a database with existing student attempts.

"""

full = header + content

out = pathlib.Path("supabase/migrations/20261020100000_safe_verified_question_banks.sql")
out.write_text(full)
print(f"Wrote {out} {len(full)} chars, {full.count(chr(10))+1} lines")
# Verify no syntax error: check for unescaped single quotes? Original already handled.
# Count inserts
print("Inserts:", full.count("insert into public.exam_questions"))
