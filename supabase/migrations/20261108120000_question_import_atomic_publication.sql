-- Harden the existing service-role import transaction; do not create a second question bank.
-- Apply only after reconciling the target migration ledger.

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

  -- Lock review rows before validating or publishing. A concurrent review/edit
  -- must wait until this transaction commits and its conditional update will
  -- then see that the row is already imported. The import row lock also
  -- serializes processing and repeated publication of this import.
  perform 1 from public.question_import_items
  where import_id = v_import.id
  order by source_index
  for update;

  -- An approved batch is all-or-nothing. Never publish valid rows while other
  -- approved rows are malformed, even if a privileged caller bypasses the UI.
  if exists (
    select 1 from public.question_import_items i
    where i.import_id = v_import.id and i.review_status = 'approved' and i.question_id is null
      and (
        length(btrim(i.question_text)) < 8
        or nullif(btrim(i.option_a), '') is null
        or nullif(btrim(i.option_b), '') is null
        or nullif(btrim(i.option_c), '') is null
        or nullif(btrim(i.option_d), '') is null
        or nullif(btrim(coalesce(i.option_e, '')), '') is not null
        or nullif(btrim(coalesce(i.passage, '')), '') is not null
        or i.correct_option is null or i.correct_option not in ('A', 'B', 'C', 'D')
        or (select count(distinct lower(regexp_replace(btrim(choice), '\s+', ' ', 'g')))
            from unnest(array[i.option_a, i.option_b, i.option_c, i.option_d]) as choice) <> 4
      )
  ) then
    raise exception 'Approved questions contain invalid or incomplete items. Review them before saving.';
  end if;

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

-- The HTTP publisher checks this service-only capability before invoking the
-- updated transaction. An unapplied migration must fail closed, not silently
-- call the older partial-publication implementation.
create or replace function public.question_import_atomic_ready()
returns boolean language sql stable security definer set search_path = ''
as $ready$ select true $ready$;
revoke execute on function public.question_import_atomic_ready() from public, anon, authenticated;
grant execute on function public.question_import_atomic_ready() to service_role;
