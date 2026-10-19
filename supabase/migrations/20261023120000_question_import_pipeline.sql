-- Universal past-question import pipeline.
--
-- A past-question file is stored once, extracted into reviewable staging rows,
-- and only becomes a CBT question after an administrator approves the staged
-- item and saves the import. The working bank (exam_questions) is never written
-- by extraction itself: an OCR/parse mistake must not reach a student's paper.
--
-- The tables are server-only. The browser never talks to them directly: the
-- Express API resolves the staff capability (`data.import`), and storage is a
-- private bucket read with the service role. Keeping them out of the PostgREST
-- surface means a publishable key cannot read an unreviewed answer key.

create table if not exists public.question_imports (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.cbt_exams(id) on delete cascade,
  exam_body text not null check (exam_body in ('JAMB', 'WAEC', 'NECO', 'POST-UTME')),
  subject text not null check (length(btrim(subject)) between 1 and 120),
  paper_year integer check (paper_year is null or paper_year between 1954 and 2100),
  source_name text,
  source_url text,
  source_verified boolean not null default false,
  original_filename text not null,
  mime_type text not null,
  file_bytes bigint not null check (file_bytes > 0 and file_bytes <= 20971520),
  checksum text not null check (checksum ~ '^[0-9a-f]{64}$'),
  storage_path text not null unique,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'extracted', 'failed', 'completed', 'archived')),
  attempts integer not null default 0 check (attempts >= 0),
  extraction_error text,
  extraction_warnings text[] not null default '{}'::text[],
  item_count integer not null default 0 check (item_count >= 0),
  approved_count integer not null default 0 check (approved_count >= 0),
  imported_count integer not null default 0 check (imported_count >= 0),
  duplicate_count integer not null default 0 check (duplicate_count >= 0),
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  check (source_verified = false or (source_name is not null and btrim(source_name) <> '')),
  check (source_url is null or source_url ~ '^https://')
);

create index if not exists question_imports_recent_idx
  on public.question_imports (created_at desc);
create index if not exists question_imports_exam_idx
  on public.question_imports (exam_id, status, created_at desc);

-- Re-uploading the same bytes for the same bank and subject returns the
-- existing import instead of creating a second review queue. Archived imports
-- are excluded so a deliberately discarded paper can be uploaded again.
create unique index if not exists question_imports_source_key
  on public.question_imports (exam_id, checksum, lower(btrim(subject)))
  where status <> 'archived';

create table if not exists public.question_import_items (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.question_imports(id) on delete cascade,
  source_index integer not null check (source_index > 0),
  question_text text not null,
  option_a text not null default '',
  option_b text not null default '',
  option_c text not null default '',
  option_d text not null default '',
  option_e text,
  correct_option char(1) check (correct_option is null or correct_option in ('A', 'B', 'C', 'D', 'E')),
  explanation text,
  passage text,
  topic text,
  raw_text text,
  review_status text not null default 'pending'
    check (review_status in ('pending', 'approved', 'rejected', 'imported')),
  issues text[] not null default '{}'::text[],
  duplicate_of uuid references public.exam_questions(id) on delete set null,
  question_id uuid references public.exam_questions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (import_id, source_index)
);

create index if not exists question_import_items_review_idx
  on public.question_import_items (import_id, review_status, source_index);

-- Question provenance back to the file it was extracted from. The reference is
-- nullable and ON DELETE SET NULL: retiring an import must never delete a
-- shared question another student is already practising.
alter table public.exam_questions
  add column if not exists import_id uuid references public.question_imports(id) on delete set null;

create index if not exists exam_questions_import_idx
  on public.exam_questions (import_id)
  where import_id is not null;

alter table public.question_imports enable row level security;
alter table public.question_import_items enable row level security;
revoke all on public.question_imports from anon, authenticated;
revoke all on public.question_import_items from anon, authenticated;
grant select, insert, update, delete on public.question_imports to service_role;
grant select, insert, update, delete on public.question_import_items to service_role;

comment on table public.question_imports is
  'One uploaded past-question file and its extraction job. Server-only; reviewed through the admin import console.';
comment on table public.question_import_items is
  'Staged questions parsed from a question_imports file. A row is copied into exam_questions only when an administrator approves it and saves the import.';
comment on column public.question_import_items.raw_text is
  'The exact text block this item was parsed from, kept so a reviewer can verify a split or merge without re-downloading the source.';
comment on column public.question_import_items.correct_option is
  'Null means the extractor did not find a trustworthy key. Null items cannot be approved or saved.';
comment on column public.question_imports.source_verified is
  'The uploader confirmed the publication source. It is not a claim that the paper structure or every answer key is correct.';

-- Private object storage for originals. The bucket exists only in a real
-- Supabase project; the PGlite replay shims it, so this block is guarded.
do $storage$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public)
    values ('past-questions', 'past-questions', false)
    on conflict (id) do update set public = false;
  end if;
end;
$storage$;

-- Claim a queued or failed job -------------------------------------------------
-- The status check and the increment are one UPDATE, so two pollers cannot both
-- process the same upload. Attempts are capped to stop a malformed file from
-- retrying forever.
create or replace function public.claim_question_import(p_import_id uuid)
returns public.question_imports
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_import public.question_imports%rowtype;
begin
  update public.question_imports i
  set status = 'processing',
      attempts = i.attempts + 1,
      extraction_error = null,
      updated_at = now()
  where i.id = p_import_id
    and i.status in ('queued', 'failed')
    and i.attempts < 5
  returning * into v_import;
  return v_import;
end;
$function$;

revoke execute on function public.claim_question_import(uuid) from public, anon, authenticated;
grant execute on function public.claim_question_import(uuid) to service_role;

-- Store an extraction result ---------------------------------------------------
create or replace function public.finish_question_import(
  p_import_id uuid,
  p_items jsonb,
  p_warnings text[] default '{}'::text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_import public.question_imports%rowtype;
  v_count integer;
begin
  select * into v_import from public.question_imports where id = p_import_id for update;
  if not found then raise exception 'Import not found.'; end if;
  if v_import.status <> 'processing' then
    raise exception 'This import is not being processed.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Extraction output must be a JSON array.';
  end if;

  -- A retry starts from a clean staging list, but only while nothing has been
  -- reviewed. Re-extraction would otherwise delete an administrator's edits and
  -- detach rows that are already in the live bank.
  if exists (
    select 1 from public.question_import_items
    where import_id = v_import.id
      and review_status <> 'pending'
  ) then
    raise exception 'This import already contains reviewed questions; start a new import instead.';
  end if;

  delete from public.question_import_items where import_id = v_import.id;

  insert into public.question_import_items(
    import_id, source_index, question_text, option_a, option_b, option_c,
    option_d, option_e, correct_option, explanation, passage, topic, raw_text,
    issues, duplicate_of
  )
  select
    v_import.id,
    (item ->> 'sourceIndex')::int,
    item ->> 'questionText',
    coalesce(item ->> 'optionA', ''),
    coalesce(item ->> 'optionB', ''),
    coalesce(item ->> 'optionC', ''),
    coalesce(item ->> 'optionD', ''),
    nullif(item ->> 'optionE', ''),
    nullif(item ->> 'correctOption', ''),
    nullif(item ->> 'explanation', ''),
    nullif(item ->> 'passage', ''),
    nullif(item ->> 'topic', ''),
    nullif(item ->> 'rawText', ''),
    coalesce(
      (select array_agg(issue.value) from jsonb_array_elements_text(coalesce(item -> 'issues', '[]'::jsonb)) as issue(value)),
      '{}'::text[]
    ),
    nullif(item ->> 'duplicateOf', '')::uuid
  from jsonb_array_elements(p_items) as item;

  select count(*)::int into v_count from public.question_import_items where import_id = v_import.id;

  update public.question_imports
  set status = 'extracted',
      item_count = v_count,
      extraction_warnings = coalesce(p_warnings, '{}'::text[]),
      extraction_error = null,
      updated_at = now()
  where id = v_import.id;

  return jsonb_build_object('items', v_count, 'status', 'extracted');
end;
$function$;

revoke execute on function public.finish_question_import(uuid, jsonb, text[]) from public, anon, authenticated;
grant execute on function public.finish_question_import(uuid, jsonb, text[]) to service_role;

-- Record a processing failure --------------------------------------------------
create or replace function public.fail_question_import(p_import_id uuid, p_error text)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  update public.question_imports
  set status = 'failed',
      extraction_error = left(coalesce(p_error, 'Extraction failed.'), 1000),
      updated_at = now()
  where id = p_import_id
    and status = 'processing';
end;
$function$;

revoke execute on function public.fail_question_import(uuid, text) from public, anon, authenticated;
grant execute on function public.fail_question_import(uuid, text) to service_role;

-- Save approved items into the live bank ---------------------------------------
-- Insert and item bookkeeping happen in one transaction. `question_id` makes a
-- repeated save idempotent: an item that already produced a bank row is never
-- inserted twice. Positions continue from the bank's current maximum, and an
-- exact duplicate of an existing question is skipped and marked instead of
-- being added with a second position.
create or replace function public.commit_question_import(p_import_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_import public.question_imports%rowtype;
  v_item public.question_import_items%rowtype;
  v_position integer;
  v_new_id uuid;
  v_inserted integer := 0;
  v_duplicates integer := 0;
  v_incomplete integer := 0;
  v_remaining integer;
begin
  select * into v_import from public.question_imports where id = p_import_id for update;
  if not found then raise exception 'Import not found.'; end if;
  if v_import.status not in ('extracted', 'completed') then
    raise exception 'This import is not ready to save.';
  end if;

  -- Two administrators can save two imports into the same bank at once. The
  -- unique (exam_id, position) constraint would turn that race into a failed
  -- save, so serialise position allocation per bank.
  perform pg_advisory_xact_lock(hashtext('cbt_bank:' || v_import.exam_id::text)::bigint);

  select coalesce(max(q.position), 0) into v_position
  from public.exam_questions q
  where q.exam_id = v_import.exam_id;

  for v_item in
    select * from public.question_import_items
    where import_id = v_import.id
      and review_status = 'approved'
      and question_id is null
    order by source_index
  loop
    if v_item.correct_option is null
       or btrim(v_item.question_text) = ''
       or btrim(v_item.option_a) = ''
       or btrim(v_item.option_b) = ''
       or btrim(v_item.option_c) = ''
       or btrim(v_item.option_d) = ''
       or nullif(btrim(coalesce(v_item.option_e, '')), '') is not null then
      v_incomplete := v_incomplete + 1;
      continue;
    end if;

    if exists (
      select 1 from public.exam_questions q
      where q.exam_id = v_import.exam_id
        and lower(regexp_replace(btrim(q.question_text), '\s+', ' ', 'g'))
          = lower(regexp_replace(btrim(v_item.question_text), '\s+', ' ', 'g'))
    ) then
      update public.question_import_items
      set review_status = 'rejected',
          issues = (
            select array_agg(distinct issue)
            from unnest(v_item.issues || array['Skipped: an identical question already exists in this bank.']) as issue
          ),
          updated_at = now()
      where id = v_item.id;
      v_duplicates := v_duplicates + 1;
      continue;
    end if;

    v_position := v_position + 1;
    insert into public.exam_questions(
      exam_id, subject, question_text, option_a, option_b, option_c, option_d,
      correct_option, explanation, marks, position, source_type, source_name,
      source_url, source_year, syllabus_topic, review_status, format_verified,
      response_type, import_id
    )
    values (
      v_import.exam_id,
      v_import.subject,
      btrim(v_item.question_text),
      btrim(v_item.option_a),
      btrim(v_item.option_b),
      btrim(v_item.option_c),
      btrim(v_item.option_d),
      v_item.correct_option,
      nullif(btrim(coalesce(v_item.explanation, '')), ''),
      1,
      v_position,
      case when v_import.source_verified then 'official_past_question' else 'unverified' end,
      v_import.source_name,
      v_import.source_url,
      v_import.paper_year,
      nullif(btrim(coalesce(v_item.topic, '')), ''),
      'approved',
      false,
      'single_choice',
      v_import.id
    )
    returning id into v_new_id;

    update public.question_import_items
    set question_id = v_new_id,
        review_status = 'imported',
        updated_at = now()
    where id = v_item.id;
    v_inserted := v_inserted + 1;
  end loop;

  select count(*)::int into v_remaining
  from public.question_import_items
  where import_id = v_import.id and review_status in ('pending', 'approved');

  update public.question_imports
  set imported_count = (
        select count(*)::int from public.question_import_items
        where import_id = v_import.id and review_status = 'imported'
      ),
      approved_count = (
        select count(*)::int from public.question_import_items
        where import_id = v_import.id and review_status = 'approved'
      ),
      duplicate_count = (
        select count(*)::int from public.question_import_items
        where import_id = v_import.id and review_status = 'rejected'
          and exists (
            select 1 from unnest(issues) as issue
            where issue like 'Skipped: an identical question%'
          )
      ),
      status = case when v_remaining = 0 then 'completed' else 'extracted' end,
      completed_at = case when v_remaining = 0 then now() else completed_at end,
      updated_at = now()
  where id = v_import.id;

  return jsonb_build_object(
    'inserted', v_inserted,
    'duplicates', v_duplicates,
    'incomplete', v_incomplete,
    'remaining', v_remaining
  );
end;
$function$;

revoke execute on function public.commit_question_import(uuid) from public, anon, authenticated;
grant execute on function public.commit_question_import(uuid) to service_role;
