-- Forward-only reconciliation for schema objects created outside migration history.
-- Safe to apply to populated projects: this migration never deletes or rewrites table rows.
-- It intentionally fails before tightening a constraint if existing data violates the target contract.

-- ccmas_programmes: align columns, required fields, status and uniqueness with the live contract.
alter table public.ccmas_programmes
  add column if not exists degree_title text,
  add column if not exists version text,
  add column if not exists status text not null default 'active';

do $$
begin
  if exists (
    select 1 from public.ccmas_programmes
    where discipline is null or programme_code is null or programme_name is null
  ) then
    raise exception 'ccmas_programmes contains NULL required fields; no rows were changed. Resolve these records before retrying.';
  end if;

  if exists (
    select 1 from public.ccmas_programmes
    where version is not null
    group by programme_code, version, programme_name
    having count(*) > 1
  ) then
    raise exception 'ccmas_programmes has duplicate (programme_code, version, programme_name) tuples; no rows were changed.';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.ccmas_programmes'::regclass
      and conname = 'ccmas_programmes_status_check'
  ) then
    alter table public.ccmas_programmes
      add constraint ccmas_programmes_status_check
      check (status in ('active', 'archived', 'draft'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.ccmas_programmes'::regclass
      and conname = 'ccmas_programmes_programme_code_version_name_key'
  ) then
    alter table public.ccmas_programmes
      add constraint ccmas_programmes_programme_code_version_name_key
      unique (programme_code, version, programme_name);
  end if;
end
$$;

alter table public.ccmas_programmes
  alter column discipline set not null,
  alter column programme_code set not null,
  alter column programme_name set not null;

-- The old create migration used this index name for an expression index.
-- The canonical live index is on discipline_id; recreate only the index, not data.
drop index if exists public.ccmas_programmes_discipline_idx;
create index ccmas_programmes_discipline_idx
  on public.ccmas_programmes (discipline_id);

-- national_programme_catalogue: preserve current source/status vocabulary and required provenance.
do $$
begin
  if exists (
    select 1 from public.national_programme_catalogue where source_url is null
  ) then
    raise exception 'national_programme_catalogue contains NULL source_url values; no rows were changed.';
  end if;

  if exists (
    select 1 from public.national_programme_catalogue
    group by programme_name
    having count(*) > 1
  ) then
    raise exception 'national_programme_catalogue contains duplicate programme_name values; no rows were changed.';
  end if;

  if exists (
    select 1 from public.national_programme_catalogue
    where source_type not in ('nuc_ccmas', 'nuc_catalogue', 'nuc_development_notice')
       or status not in ('catalogued', 'active_ccmas', 'in_development', 'archived')
  ) then
    raise exception 'national_programme_catalogue contains values outside the live source_type/status contract; no rows were changed.';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.national_programme_catalogue'::regclass
      and conname = 'national_programme_catalogue_source_type_check'
  ) then
    alter table public.national_programme_catalogue
      add constraint national_programme_catalogue_source_type_check
      check (source_type in ('nuc_ccmas', 'nuc_catalogue', 'nuc_development_notice'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.national_programme_catalogue'::regclass
      and conname = 'national_programme_catalogue_status_check'
  ) then
    alter table public.national_programme_catalogue
      add constraint national_programme_catalogue_status_check
      check (status in ('catalogued', 'active_ccmas', 'in_development', 'archived'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.national_programme_catalogue'::regclass
      and conname = 'national_programme_catalogue_programme_name_key'
  ) then
    alter table public.national_programme_catalogue
      add constraint national_programme_catalogue_programme_name_key unique (programme_name);
  end if;
end
$$;

alter table public.national_programme_catalogue
  alter column source_url set not null,
  alter column source_type set default 'nuc_catalogue',
  alter column status set default 'catalogued';

-- daily_quizzes: the live schema permits a NULL discipline and has updated_at.
alter table public.daily_quizzes
  add column if not exists updated_at timestamptz not null default now(),
  alter column discipline drop not null;

-- daily_quiz_questions: preserve the course relationship and match the live bounds.
alter table public.daily_quiz_questions
  add column if not exists course_id uuid;

do $$
begin
  if exists (
    select 1 from public.daily_quiz_questions
    where points < 1 or points > 100 or position < 1 or position > 20
  ) then
    raise exception 'daily_quiz_questions contains points/position outside the live 1..100 and 1..20 bounds; no rows were changed.';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.daily_quiz_questions'::regclass
      and conname = 'daily_quiz_questions_course_id_fkey'
  ) then
    alter table public.daily_quiz_questions
      add constraint daily_quiz_questions_course_id_fkey
      foreign key (course_id) references public.courses(id) on delete set null;
  end if;
end
$$;

alter table public.daily_quiz_questions
  alter column points type smallint using points::smallint;

alter table public.daily_quiz_questions
  drop constraint if exists daily_quiz_questions_points_check,
  add constraint daily_quiz_questions_points_check check (points > 0 and points <= 100),
  drop constraint if exists daily_quiz_questions_position_check,
  add constraint daily_quiz_questions_position_check check (position > 0 and position <= 20);

-- Student portal tables used by src/lib/studentDashboard.ts were absent from the live
-- project. Create the non-payment workflows forward-only; do not recreate wallet/payment
-- transaction tables because payment integration is retired.

create table if not exists public.student_saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_type text not null check (item_type in ('school', 'course', 'service', 'scholarship', 'custom')),
  item_key text not null,
  title text not null,
  subtitle text,
  detail text,
  location text,
  href text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, item_type, item_key)
);
create index if not exists student_saved_items_user_created_idx
  on public.student_saved_items (user_id, created_at desc);

create table if not exists public.student_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  notification_type text not null default 'system',
  href text,
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists student_notifications_user_read_created_idx
  on public.student_notifications (user_id, read_at, created_at desc);

create table if not exists public.student_cgpa_terms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  term_label text not null default 'Current Semester',
  gpa numeric(4,2) not null default 0 check (gpa >= 0 and gpa <= 5),
  total_units integer not null default 0 check (total_units >= 0),
  classification text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists student_cgpa_terms_user_created_idx
  on public.student_cgpa_terms (user_id, created_at desc);

create table if not exists public.student_cgpa_courses (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.student_cgpa_terms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_code text not null,
  units integer not null check (units > 0 and units <= 10),
  grade text not null check (grade in ('A', 'B', 'C', 'D', 'E', 'F')),
  grade_points integer not null check (grade_points >= 0 and grade_points <= 5),
  created_at timestamptz not null default now()
);
create index if not exists student_cgpa_courses_term_idx
  on public.student_cgpa_courses (term_id, created_at asc);

create table if not exists public.student_security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  event_label text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists student_security_events_user_created_idx
  on public.student_security_events (user_id, created_at desc);

create or replace function public.set_student_portal_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

drop trigger if exists student_saved_items_set_updated_at on public.student_saved_items;
create trigger student_saved_items_set_updated_at
before update on public.student_saved_items
for each row execute function public.set_student_portal_updated_at();

drop trigger if exists student_cgpa_terms_set_updated_at on public.student_cgpa_terms;
create trigger student_cgpa_terms_set_updated_at
before update on public.student_cgpa_terms
for each row execute function public.set_student_portal_updated_at();

alter table public.student_saved_items enable row level security;
alter table public.student_notifications enable row level security;
alter table public.student_cgpa_terms enable row level security;
alter table public.student_cgpa_courses enable row level security;
alter table public.student_security_events enable row level security;

drop policy if exists student_saved_items_owner_select on public.student_saved_items;
drop policy if exists student_saved_items_owner_insert on public.student_saved_items;
drop policy if exists student_saved_items_owner_update on public.student_saved_items;
drop policy if exists student_saved_items_owner_delete on public.student_saved_items;
create policy student_saved_items_owner_select on public.student_saved_items
for select to authenticated using (user_id = (select auth.uid()));
create policy student_saved_items_owner_insert on public.student_saved_items
for insert to authenticated with check (user_id = (select auth.uid()));
create policy student_saved_items_owner_update on public.student_saved_items
for update to authenticated using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
create policy student_saved_items_owner_delete on public.student_saved_items
for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists student_notifications_owner_select on public.student_notifications;
drop policy if exists student_notifications_owner_insert on public.student_notifications;
drop policy if exists student_notifications_owner_update on public.student_notifications;
drop policy if exists student_notifications_owner_delete on public.student_notifications;
drop policy if exists student_notifications_staff_insert on public.student_notifications;
create policy student_notifications_owner_select on public.student_notifications
for select to authenticated using (user_id = (select auth.uid()));
create policy student_notifications_owner_insert on public.student_notifications
for insert to authenticated with check (user_id = (select auth.uid()));
create policy student_notifications_owner_update on public.student_notifications
for update to authenticated using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
create policy student_notifications_owner_delete on public.student_notifications
for delete to authenticated using (user_id = (select auth.uid()));
create policy student_notifications_staff_insert on public.student_notifications
for insert to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('admin','super_admin','moderator','senate_admin','campus_agent')
  )
);

drop policy if exists student_cgpa_terms_owner_select on public.student_cgpa_terms;
drop policy if exists student_cgpa_terms_owner_insert on public.student_cgpa_terms;
drop policy if exists student_cgpa_terms_owner_update on public.student_cgpa_terms;
drop policy if exists student_cgpa_terms_owner_delete on public.student_cgpa_terms;
create policy student_cgpa_terms_owner_select on public.student_cgpa_terms
for select to authenticated using (user_id = (select auth.uid()));
create policy student_cgpa_terms_owner_insert on public.student_cgpa_terms
for insert to authenticated with check (user_id = (select auth.uid()));
create policy student_cgpa_terms_owner_update on public.student_cgpa_terms
for update to authenticated using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
create policy student_cgpa_terms_owner_delete on public.student_cgpa_terms
for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists student_cgpa_courses_owner_select on public.student_cgpa_courses;
drop policy if exists student_cgpa_courses_owner_insert on public.student_cgpa_courses;
drop policy if exists student_cgpa_courses_owner_update on public.student_cgpa_courses;
drop policy if exists student_cgpa_courses_owner_delete on public.student_cgpa_courses;
create policy student_cgpa_courses_owner_select on public.student_cgpa_courses
for select to authenticated using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.student_cgpa_terms t
    where t.id = term_id and t.user_id = (select auth.uid())
  )
);
create policy student_cgpa_courses_owner_insert on public.student_cgpa_courses
for insert to authenticated with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.student_cgpa_terms t
    where t.id = term_id and t.user_id = (select auth.uid())
  )
);
create policy student_cgpa_courses_owner_update on public.student_cgpa_courses
for update to authenticated using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.student_cgpa_terms t
    where t.id = term_id and t.user_id = (select auth.uid())
  )
) with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.student_cgpa_terms t
    where t.id = term_id and t.user_id = (select auth.uid())
  )
);
create policy student_cgpa_courses_owner_delete on public.student_cgpa_courses
for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists student_security_events_owner_select on public.student_security_events;
drop policy if exists student_security_events_owner_insert on public.student_security_events;
create policy student_security_events_owner_select on public.student_security_events
for select to authenticated using (user_id = (select auth.uid()));
create policy student_security_events_owner_insert on public.student_security_events
for insert to authenticated with check (user_id = (select auth.uid()));

revoke all on table public.student_saved_items, public.student_notifications,
  public.student_cgpa_terms, public.student_cgpa_courses, public.student_security_events
  from public, anon, authenticated;
grant select, insert, update, delete on table public.student_saved_items to authenticated;
grant select, insert, update, delete on table public.student_notifications to authenticated;
grant select, insert, update, delete on table public.student_cgpa_terms to authenticated;
grant select, insert, update, delete on table public.student_cgpa_courses to authenticated;
grant select, insert on table public.student_security_events to authenticated;

-- Canonical admin audit log used by server.ts. Client roles have no table access.
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_logs_created_idx
  on public.admin_audit_logs (created_at desc);
create index if not exists admin_audit_logs_entity_idx
  on public.admin_audit_logs (entity_type, entity_id);
alter table public.admin_audit_logs enable row level security;
revoke all on table public.admin_audit_logs from public, anon, authenticated, service_role;
grant select on table public.admin_audit_logs to service_role;

create or replace function public.admin_audit_log(
  p_admin_user_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id uuid;
begin
  insert into public.admin_audit_logs(admin_user_id, action, entity_type, entity_id, metadata)
  values (p_admin_user_id, p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$function$;
revoke all on function public.admin_audit_log(uuid,text,text,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.admin_audit_log(uuid,text,text,uuid,jsonb) to service_role;

-- Existing payment-related tables/functions are intentionally not recreated:
-- payments are out of scope, and the student portal uses no wallet transaction write path.

-- Keep answer-key and attempt mutations behind the server-authoritative RPCs.
revoke all on table public.exam_questions from public, anon, authenticated;
revoke all on table public.cbt_attempts from public, anon, authenticated;
grant select on table public.cbt_attempts to authenticated;
revoke all on table public.cbt_answers from public, anon, authenticated;

-- Service requests may be created only for an active catalogue item.
-- This uses the existing active-only SELECT policy on service_catalog; no SECURITY DEFINER
-- function is needed, and the caller can still submit only for their own account.
drop policy if exists service_requests_insert_own on public.service_requests;
create policy service_requests_insert_own
  on public.service_requests
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'submitted'
    and exists (
      select 1
      from public.service_catalog sc
      where sc.id = service_requests.service_id
        and sc.active is true
    )
  );

