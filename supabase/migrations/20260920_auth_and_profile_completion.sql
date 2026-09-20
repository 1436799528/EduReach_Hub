-- EduReach User Auth & Profile Completion Migration
-- 1. Extend profiles with required auth & post-registration fields
-- 2. Strictly exclude sensitive PII (NIN, BVN, ID docs, address) from registration
-- 3. Support session tracking, email verification status, and notification preferences

alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists account_type text check (account_type in ('student', 'parent', 'teacher')) default 'student',
  add column if not exists course_programme text,
  add column if not exists admission_year int,
  add column if not exists expected_graduation_year int,
  add column if not exists academic_interests text[] default '{}'::text[],
  add column if not exists notification_preferences jsonb default '{"email_alerts": true, "whatsapp_alerts": true, "sms_alerts": false}'::jsonb,
  add column if not exists avatar_url text,
  add column if not exists terms_agreed_at timestamptz,
  add column if not exists profile_completed boolean default false,
  add column if not exists mfa_enabled boolean default false;

-- Update trigger function to handle first_name, last_name, account_type, and terms
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_first text := coalesce(new.raw_user_meta_data->>'first_name', split_part(coalesce(new.raw_user_meta_data->>'full_name', ''), ' ', 1));
  v_last text := coalesce(new.raw_user_meta_data->>'last_name', substr(coalesce(new.raw_user_meta_data->>'full_name', ''), length(v_first) + 2));
  v_full text := trim(concat(v_first, ' ', v_last));
begin
  insert into public.profiles (
    id, first_name, last_name, full_name,
    phone, account_type, terms_agreed_at,
    school, course_programme, faculty, department, level,
    role, profile_completed
  )
  values (
    new.id,
    v_first,
    v_last,
    case when length(v_full) > 0 then v_full else coalesce(new.email, 'EduReach User') end,
    nullif(trim(new.raw_user_meta_data->>'phone'), ''),
    coalesce(new.raw_user_meta_data->>'account_type', 'student'),
    case when (new.raw_user_meta_data->>'terms_agreed')::boolean is true then now() else null end,
    coalesce(new.raw_user_meta_data->>'school', new.raw_user_meta_data->>'institution', ''),
    coalesce(new.raw_user_meta_data->>'course_programme', ''),
    coalesce(new.raw_user_meta_data->>'faculty', ''),
    coalesce(new.raw_user_meta_data->>'department', ''),
    coalesce(new.raw_user_meta_data->>'level', ''),
    'student',
    false
  )
  on conflict (id) do update set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    full_name = excluded.full_name,
    phone = coalesce(public.profiles.phone, excluded.phone),
    account_type = coalesce(public.profiles.account_type, excluded.account_type);

  insert into public.student_wallets (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Grant column update permissions to authenticated users
grant update (
  first_name, last_name, full_name, phone, account_type,
  avatar_url, school, course_programme, faculty, department,
  level, admission_year, expected_graduation_year,
  academic_interests, notification_preferences, terms_agreed_at,
  profile_completed, mfa_enabled
) on table public.profiles to authenticated;
