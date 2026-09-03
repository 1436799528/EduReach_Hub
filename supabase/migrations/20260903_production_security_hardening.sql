begin;

-- Backend-only student-profile trigger/function execution.
revoke execute on function public.handle_new_student_profile() from anon, authenticated;
grant execute on function public.handle_new_student_profile() to service_role;

-- Material notes: user-owned data only.
create table if not exists public.edureach_material_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  material_id text not null,
  course_code text not null,
  material_title text not null,
  content text not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);
create index if not exists idx_material_notes_user_material on public.edureach_material_notes (user_id, material_id, created_at desc);
create index if not exists idx_material_notes_user_created on public.edureach_material_notes (user_id, created_at desc);
alter table public.edureach_material_notes enable row level security;
drop policy if exists material_notes_owner_read on public.edureach_material_notes;
drop policy if exists material_notes_owner_insert on public.edureach_material_notes;
drop policy if exists material_notes_owner_update on public.edureach_material_notes;
drop policy if exists material_notes_owner_delete on public.edureach_material_notes;
create policy material_notes_owner_read on public.edureach_material_notes for select to authenticated using (user_id = auth.uid());
create policy material_notes_owner_insert on public.edureach_material_notes for insert to authenticated with check (user_id = auth.uid());
create policy material_notes_owner_update on public.edureach_material_notes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy material_notes_owner_delete on public.edureach_material_notes for delete to authenticated using (user_id = auth.uid());

-- Students cannot mutate service-request workflow fields after creation.
drop policy if exists service_requests_update_own on public.service_requests;
drop policy if exists service_requests_update_submitted on public.service_requests;

-- Students cannot mutate moderated campus-post rows through the client.
drop policy if exists campus_posts_update_own on public.campus_posts;
drop policy if exists campus_posts_update_own_pending on public.campus_posts;

-- Expose only safe author fields for the Campus Feed.
create or replace function public.get_campus_feed_profiles(p_ids uuid[])
returns table (
  id uuid,
  full_name text,
  school text,
  department text,
  level text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.school, p.department, p.level
  from public.profiles p
  where p.id = any(p_ids);
$$;
revoke all on function public.get_campus_feed_profiles(uuid[]) from public;
grant execute on function public.get_campus_feed_profiles(uuid[]) to authenticated;

-- Storage reads must follow resource/post visibility rather than broad authenticated access.
drop policy if exists resource_files_read_auth on storage.objects;
drop policy if exists campus_uploads_read_auth on storage.objects;
create policy resource_files_read_entitled on storage.objects
for select to authenticated
using (
  bucket_id = 'resource-files'
  and (
    owner_id = auth.uid()::text
    or exists (
      select 1 from public.resources r
      where r.storage_path = name
        and (
          r.uploaded_by = auth.uid()
          or public.is_staff(auth.uid())
          or (
            r.status = 'approved'
            and (
              r.course_id is null
              or exists (
                select 1 from public.courses c
                join public.profiles p on p.programme_id = c.programme_id
                where c.id = r.course_id and p.id = auth.uid()
              )
            )
          )
        )
    )
  )
);
create policy campus_uploads_read_entitled on storage.objects
for select to authenticated
using (
  bucket_id = 'campus-uploads'
  and (
    owner_id = auth.uid()::text
    or public.is_staff(auth.uid())
    or exists (
      select 1 from public.campus_posts cp
      where cp.attachment_path = name
        and cp.moderation_status = 'APPROVED'
    )
  )
);

commit;
