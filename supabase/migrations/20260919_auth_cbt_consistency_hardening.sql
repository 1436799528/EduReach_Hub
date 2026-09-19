-- EduReach production consistency hardening
-- 1. Create profiles/wallets automatically for every new Supabase auth user.
-- 2. Keep CBT answer keys out of browser-readable RLS.
-- 3. Prevent duplicate concurrent attempts for the same user/exam.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, full_name, school, faculty, department, level, session,
    phone, jamb_reg_no, target_exam, role
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'school', new.raw_user_meta_data->>'institution', ''),
    coalesce(new.raw_user_meta_data->>'faculty', ''),
    coalesce(new.raw_user_meta_data->>'department', ''),
    coalesce(new.raw_user_meta_data->>'level', ''),
    coalesce(new.raw_user_meta_data->>'session', ''),
    nullif(trim(new.raw_user_meta_data->>'phone'), ''),
    nullif(trim(coalesce(
      new.raw_user_meta_data->>'jamb_registration_number',
      new.raw_user_meta_data->>'jamb_reg_no'
    )), ''),
    coalesce(new.raw_user_meta_data->>'target_exam', 'JAMB (UTME)'),
    'student'
  )
  on conflict (id) do nothing;

  insert into public.student_wallets (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

drop policy if exists "Public can read exam questions for active exams" on public.exam_questions;

create unique index if not exists cbt_attempts_one_in_progress_per_user_exam
  on public.cbt_attempts (user_id, exam_id)
  where status = 'in_progress';
