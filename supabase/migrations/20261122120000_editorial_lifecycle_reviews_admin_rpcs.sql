-- Editorial lifecycle, genuine reviews, and two protected admin RPCs.
--
-- Three independent gaps are closed here, additively:
--
--   1. Opportunities (scholarships/grants) had a deadline but no publication
--      window. A passed deadline stayed in the "latest" list until somebody
--      edited the row, and the public route had no archive to put it in. The
--      columns added below let the listing decide for itself: published_at,
--      expires_at, opens_at (upcoming), status (editorial workflow tracks
--      published/archived; the open/closing/closed state is derived from the
--      dates so it cannot go stale) plus the facts a scholarship card needs.
--
--   2. There was no review system at all. `reviews` holds one review per
--      student, in pending state until a moderator approves it. The public
--      rating average is computed from approved rows only, never stored as a
--      number somebody could type.
--
--   3. Two admin operations that the console needs were split across a
--      capability gate and a bare table write. They are now single RPCs that
--      re-check the actor, validate the input, write the change and the audit
--      row in one transaction:
--        * admin_set_user_role      (role management)
--        * admin_question_bank_summary (real question-bank counts)
--
-- Nothing here weakens RLS. The new table has no client grants; both new
-- functions are executable only by service_role, and the HTTP layer still
-- requires the matching capability before it will call them.

-- ---------------------------------------------------------------------------
-- 1. Opportunity lifecycle and scholarship facts
-- ---------------------------------------------------------------------------

alter table public.opportunities
  add column if not exists slug text,
  add column if not exists published_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists opens_at date,
  add column if not exists status text not null default 'published',
  add column if not exists award text,
  add column if not exists study_level text,
  add column if not exists verified_at timestamptz;

do $opportunity_status$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'opportunities_status_check'
      and conrelid = 'public.opportunities'::regclass
  ) then
    alter table public.opportunities
      add constraint opportunities_status_check
      check (status in ('draft', 'published', 'archived'));
  end if;
end
$opportunity_status$;

-- One row per listing slug. Existing rows predate slugs; PostgreSQL treats
-- NULLs as distinct in a unique index, so those rows coexist while a real slug
-- stays unique (and `on conflict (slug)` can use the constraint).
create unique index if not exists opportunities_slug_key
  on public.opportunities (slug);

create index if not exists opportunities_lifecycle_idx
  on public.opportunities (status, published_at desc nulls last, deadline asc nulls last);

comment on column public.opportunities.status is
  'Editorial workflow: draft, published or archived. Whether a published listing is open, closing soon, upcoming or closed is derived from opens_at/deadline/expires_at, not stored, so it cannot go stale.';
comment on column public.opportunities.expires_at is
  'When the listing should leave the active feed even if no deadline is recorded. NULL for an evergreen listing whose deadline governs.';
comment on column public.opportunities.verified_at is
  'When EduReach last checked the listing against the provider. Distinct from last_verified_at, which the newsroom pipeline owns.';
comment on column public.opportunities.award is
  'The benefit in the provider own words. NULL means it has not been recorded; the card then says so rather than inventing an amount.';
comment on column public.opportunities.study_level is
  'Undergraduate, postgraduate, secondary, etc. Free text because providers use different names.';

-- Existing rows are published; their feed state is still derived from dates.
update public.opportunities
   set published_at = coalesce(published_at, created_at)
 where published_at is null;

-- ---------------------------------------------------------------------------
-- 2. Reviews
-- ---------------------------------------------------------------------------

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- An integer 1-5. A 0 or a 7 is not a rating, it is a bug.
  rating smallint not null check (rating between 1 and 5),
  review_text text not null,
  exam_type text check (
    exam_type is null or exam_type in ('JAMB', 'WAEC', 'NECO', 'POST-UTME', 'Other')
  ),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'hidden')),
  moderation_note text,
  moderated_by uuid references auth.users(id) on delete set null,
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Empty or one-word reviews are noise. The range mirrors the client's
  -- minimum so a validation change cannot diverge between browser and server.
  constraint reviews_text_length
    check (char_length(btrim(review_text)) between 20 and 1200)
);

-- One review per student. A student who is unhappy with a typo edits their
-- review; they do not stack five of them. The API answers a repeat submission
-- with the existing row instead of an error.
create unique index if not exists reviews_one_per_student
  on public.reviews (user_id);

create index if not exists reviews_moderation_idx
  on public.reviews (status, created_at desc);
create index if not exists reviews_approved_idx
  on public.reviews (created_at desc)
  where status = 'approved';

alter table public.reviews enable row level security;

-- Server-only: reviews are read and written by the API after it has decided
-- who may see them. A client grant here would expose pending and rejected
-- opinions, and the moderator's note, to anyone with the publishable key.
revoke all on public.reviews from anon, authenticated;
grant select, insert, update, delete on public.reviews to service_role;

comment on table public.reviews is
  'Genuine student reviews. One per student; pending until a moderator approves. Public averages are computed from approved rows only.';

-- Keep updated_at honest without asking the caller to send it.
create or replace function public.reviews_touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

revoke all on function public.reviews_touch_updated_at() from public, anon, authenticated, service_role;

drop trigger if exists reviews_touch_updated_at on public.reviews;
create trigger reviews_touch_updated_at
  before update on public.reviews
  for each row execute function public.reviews_touch_updated_at();

-- The public rating summary. One aggregate read, no review rows, so the home
-- or About page cannot accidentally download every opinion to average it.
-- `review_count` is the number of approved reviews; the client shows the
-- "be one of the first" state when it is 0.
create or replace function public.review_rating_summary()
returns table(review_count bigint, average_rating numeric)
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint,
         case when count(*) = 0 then null else round(avg(rating)::numeric, 2) end
  from public.reviews
  where status = 'approved';
$$;

revoke all on function public.review_rating_summary() from public, anon, authenticated, service_role;
grant execute on function public.review_rating_summary() to service_role;

-- ---------------------------------------------------------------------------
-- 3. Role changes: one authorized, audited transaction
-- ---------------------------------------------------------------------------
--
-- The HTTP endpoint still requires `user.manage_roles`, and this function
-- re-checks the actor's stored role, so a mistyped route or a leaked service
-- key cannot promote an account without an attributable actor. The previous
-- role and the new one are recorded; no email, token or password is.
create or replace function public.admin_set_user_role(
  p_actor uuid,
  p_target uuid,
  p_role text
)
returns table(previous_role text, new_role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text;
  v_target_role text;
  v_role text := lower(btrim(coalesce(p_role, '')));
  v_remaining_admins integer;
begin
  if p_actor is null or p_target is null then
    raise exception 'An actor and a target account are required.' using errcode = '22023';
  end if;
  if v_role not in ('student', 'content_editor', 'service_admin', 'super_admin') then
    raise exception 'Unknown role.' using errcode = '22023';
  end if;
  if p_actor = p_target then
    raise exception 'You cannot change your own role.' using errcode = '22023';
  end if;

  select pr.role into v_actor_role
    from public.profiles pr
   where pr.id = p_actor;
  if v_actor_role is null or v_actor_role not in ('super_admin', 'admin', 'moderator') then
    raise exception 'You do not have permission to change account roles.' using errcode = '42501';
  end if;

  select pr.role into v_target_role
    from public.profiles pr
   where pr.id = p_target
   for update;
  if v_target_role is null then
    raise exception 'Account not found.' using errcode = 'P0002';
  end if;

  -- The console must stay recoverable: the last super admin cannot demote
  -- themselves or a peer and leave nobody with `user.manage_roles`.
  if v_target_role in ('super_admin', 'admin', 'moderator') and v_role <> 'super_admin' then
    select count(*) into v_remaining_admins
      from public.profiles pr
     where pr.id <> p_target
       and pr.role in ('super_admin', 'admin', 'moderator');
    if v_remaining_admins = 0 then
      raise exception 'The last administrator cannot be demoted. Assign another admin first.' using errcode = '42501';
    end if;
  end if;

  update public.profiles
     set role = v_role
   where id = p_target;

  insert into public.admin_audit_logs (admin_user_id, action, entity_type, entity_id, metadata)
  values (
    p_actor,
    'user_role_change',
    'profile',
    p_target,
    jsonb_build_object('from', v_target_role, 'to', v_role)
  );

  return query select v_target_role::text, v_role::text;
end
$$;

revoke all on function public.admin_set_user_role(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_set_user_role(uuid, uuid, text) to service_role;

comment on function public.admin_set_user_role(uuid, uuid, text) is
  'Changes a stored profile role after re-checking the actor, refusing self-modification and the last-admin demotion, and writes the audit row in the same transaction.';

-- ---------------------------------------------------------------------------
-- 4. Question-bank summary: real counts, one row per exam body
-- ---------------------------------------------------------------------------
--
-- The dashboard needs JAMB/WAEC/NECO/POST-UTME with the number of questions,
-- subjects, years, last update and review status. Counting in the browser
-- means downloading the bank; counting with four hard-coded numbers means
-- lying. This function aggregates the actual rows, and the canonical four
-- bodies are included even at zero so an empty bank is visibly empty.
create or replace function public.admin_question_bank_summary()
returns table (
  exam_body text,
  bank_count bigint,
  question_count bigint,
  approved_count bigint,
  needs_review_count bigint,
  rejected_count bigint,
  subject_count bigint,
  subjects text[],
  first_year integer,
  last_year integer,
  last_updated timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with questions as (
    select
      case
        when upper(coalesce(e.exam_body, '')) like '%POST%UTME%' then 'POST-UTME'
        when upper(coalesce(e.exam_body, '')) like 'JAMB%' then 'JAMB'
        when upper(coalesce(e.exam_body, '')) like 'WAEC%' then 'WAEC'
        when upper(coalesce(e.exam_body, '')) like 'NECO%' then 'NECO'
        else nullif(upper(btrim(coalesce(e.exam_body, ''))), '')
      end as body,
      e.id as exam_id,
      q.id as question_id,
      q.review_status,
      nullif(btrim(coalesce(q.subject, '')), '') as subject,
      q.source_year,
      greatest(coalesce(q.updated_at, q.created_at), coalesce(e.updated_at, e.created_at)) as touched_at
    from public.cbt_exams e
    left join public.exam_questions q on q.exam_id = e.id
  ),
  bodies as (
    select unnest(array['JAMB', 'WAEC', 'NECO', 'POST-UTME']) as body
    union
    select distinct body from questions where body is not null
  ),
  aggregated as (
    select
      q.body,
      count(distinct q.exam_id) as bank_count,
      count(q.question_id) as question_count,
      count(q.question_id) filter (where q.review_status = 'approved') as approved_count,
      count(q.question_id) filter (where q.review_status = 'needs_review') as needs_review_count,
      count(q.question_id) filter (where q.review_status = 'rejected') as rejected_count,
      count(distinct q.subject) filter (where q.subject is not null) as subject_count,
      coalesce(
        array_agg(distinct q.subject order by q.subject) filter (where q.subject is not null),
        array[]::text[]
      ) as subjects,
      min(q.source_year) as first_year,
      max(q.source_year) as last_year,
      max(q.touched_at) as last_updated
    from questions q
    where q.body is not null
    group by q.body
  )
  select
    b.body,
    coalesce(a.bank_count, 0)::bigint,
    coalesce(a.question_count, 0)::bigint,
    coalesce(a.approved_count, 0)::bigint,
    coalesce(a.needs_review_count, 0)::bigint,
    coalesce(a.rejected_count, 0)::bigint,
    coalesce(a.subject_count, 0)::bigint,
    coalesce(a.subjects, array[]::text[]),
    a.first_year,
    a.last_year,
    a.last_updated
  from bodies b
  left join aggregated a on a.body = b.body
  order by
    case b.body when 'JAMB' then 1 when 'WAEC' then 2 when 'NECO' then 3 when 'POST-UTME' then 4 else 5 end,
    b.body;
$$;

revoke all on function public.admin_question_bank_summary() from public, anon, authenticated;
grant execute on function public.admin_question_bank_summary() to service_role;

comment on function public.admin_question_bank_summary() is
  'Per-exam-body question counts, subjects, source years and last update, aggregated from cbt_exams/exam_questions. The four canonical exam bodies are returned even at zero.';

-- ---------------------------------------------------------------------------
-- 5. Review moderation lookup
-- ---------------------------------------------------------------------------

-- The moderation queue joins the reviewer's profile for a display name. This
-- view is not granted to clients; it exists so the API query stays readable
-- and never selects an email address.
create or replace view public.review_moderation_queue as
  select
    r.id,
    r.user_id,
    r.rating,
    r.review_text,
    r.exam_type,
    r.status,
    r.moderation_note,
    r.created_at,
    r.updated_at,
    nullif(btrim(coalesce(p.full_name, '')), '') as display_name
  from public.reviews r
  left join public.profiles p on p.id = r.user_id;

revoke all on public.review_moderation_queue from public, anon, authenticated;
grant select on public.review_moderation_queue to service_role;

comment on view public.review_moderation_queue is
  'Review rows with a display name for staff moderation. No email, token or other account detail is exposed.';
