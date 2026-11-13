-- INCOMPLETE LOCAL CANDIDATE: DO NOT DEPLOY. Depends on
-- restricted_bank_policy_foundation.sql (cbt_bank_security) and
-- restricted_bank_admin_candidate.sql (audit + publication guard).
--
-- Question provenance guard. Bank classification alone cannot stop restricted
-- material being re-typed, re-imported or duplicated into a public bank, and
-- `cbt_bank_question_move_guard` only refuses moving an existing row. This
-- candidate adds the smallest content-level control: a question whose text
-- already exists in a restricted bank cannot be created or edited into any
-- non-restricted bank.
--
-- Deliberate limits:
--   * It never classifies, reclassifies or backfills anything. Historical rows
--     keep their existing classification (or their lack of one).
--   * It does not record or invent a "source bank" for existing questions.
--   * It is a text-identity check, not a semantic one: a paraphrase is not
--     detected, and it does not replace the provenance tracking an approved
--     migration must eventually provide.
--   * Copying public material *into* a restricted bank stays allowed; that
--     direction cannot disclose restricted content.
begin;

-- Same normalisation as `questionFingerprint` in
-- src/server/question-import/validate.ts: case-folded, curly quotes folded to
-- straight ones, every run of non-alphanumerics collapsed to one space, ends
-- trimmed. Kept in the database so no application path can skip it.
create function public.cbt_question_text_fingerprint(p_text text) returns text
language sql immutable set search_path = '' as $$
  select btrim(regexp_replace(
    replace(replace(replace(replace(lower(btrim(coalesce(p_text, ''))),
      chr(8216), ''''), chr(8217), ''''), chr(8220), '"'), chr(8221), '"'),
    '[^a-z0-9]+', ' ', 'g'))
$$;
revoke all on function public.cbt_question_text_fingerprint(text) from public, anon, authenticated, service_role;

create function public.cbt_question_provenance_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_text text := public.cbt_question_text_fingerprint(new.question_text);
  v_destination text;
begin
  if v_text = '' then return new; end if;
  select s.visibility into v_destination from public.cbt_bank_security s
    where s.exam_id = new.exam_id;
  -- destination restricted, or destination unclassified with no restricted
  -- banks in play: nothing to disclose.
  if v_destination = 'restricted' then return new; end if;
  if exists (
    select 1
    from public.exam_questions q
    join public.cbt_bank_security s on s.exam_id = q.exam_id
    where s.visibility = 'restricted'
      and q.exam_id is distinct from new.exam_id
      and public.cbt_question_text_fingerprint(q.question_text) = v_text
  ) then
    -- The message names no title, text, bank or answer; only that a restricted
    -- bank already holds this question. `detail` is the machine-readable
    -- identifier the server classifies on: 42501 alone also covers permission
    -- denials and the other policy gates, so the SQLSTATE cannot be used by
    -- itself. Keep this value and the sentence in sync with
    -- src/server/questionProvenance.ts (a test asserts it).
    raise exception 'This question text already exists in a restricted bank. It cannot be added to a public or unclassified bank.'
      using errcode = '42501',
            detail = 'cbt_question_provenance_guard';
  end if;
  return new;
end $$;
revoke all on function public.cbt_question_provenance_guard() from public, anon, authenticated, service_role;

drop trigger if exists cbt_question_provenance_guard on public.exam_questions;
create trigger cbt_question_provenance_guard
  before insert or update of question_text, exam_id on public.exam_questions
  for each row execute function public.cbt_question_provenance_guard();

-- A restricted bank must not be able to exist while the copy guard is missing,
-- otherwise classification could be applied in a half-migrated state and the
-- material could still be duplicated out. Fails closed at classification time,
-- which is the only point a restricted bank can appear.
create function public.cbt_restricted_requires_provenance() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.visibility = 'restricted' and not exists (
    select 1 from pg_trigger t
    where t.tgrelid = 'public.exam_questions'::regclass
      and t.tgname = 'cbt_question_provenance_guard'
      and t.tgenabled = 'O'
  ) then
    raise exception 'Restricted banks require the question provenance guard. Apply the reviewed provenance change first.'
      using errcode = '42501',
            detail = 'cbt_question_provenance_guard_missing';
  end if;
  return new;
end $$;
revoke all on function public.cbt_restricted_requires_provenance() from public, anon, authenticated, service_role;

drop trigger if exists cbt_restricted_requires_provenance on public.cbt_bank_security;
create trigger cbt_restricted_requires_provenance
  before insert on public.cbt_bank_security
  for each row execute function public.cbt_restricted_requires_provenance();

-- Readiness marker for staging verification and operational checks. The
-- application does not probe it: the trigger itself is authoritative, and a
-- deployment without it also has no restricted banks (see the trigger above).
create function public.cbt_question_provenance_ready() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from pg_trigger t
    where t.tgrelid = 'public.exam_questions'::regclass
      and t.tgname = 'cbt_question_provenance_guard'
      and t.tgenabled = 'O'
  )
$$;
revoke all on function public.cbt_question_provenance_ready() from public, anon, authenticated, service_role;
grant execute on function public.cbt_question_provenance_ready() to service_role;

commit;
