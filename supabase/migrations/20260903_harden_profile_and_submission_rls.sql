begin;

-- Students may create only student profiles. Elevated roles are staff-controlled.
drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own student profile" on public.profiles
for insert to authenticated
with check (id = auth.uid() and role = 'student');

-- Students may edit their own profile while remaining students; staff use the staff policy.
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Students can update their own profile" on public.profiles
for update to authenticated
using (id = auth.uid() and role = 'student')
with check (id = auth.uid() and role = 'student');
create policy "Staff can update profiles" on public.profiles
for update to authenticated
using (public.is_staff(auth.uid()))
with check (public.is_staff(auth.uid()));

-- User submissions must enter moderation in pending state.
drop policy if exists campus_posts_insert_own on public.campus_posts;
create policy campus_posts_insert_own on public.campus_posts
for insert to authenticated
with check (author_id = auth.uid() and moderation_status = 'PENDING_REVIEW');

drop policy if exists "authenticated users can submit past questions" on public.past_questions;
create policy "authenticated users can submit past questions" on public.past_questions
for insert to authenticated
with check (uploaded_by = auth.uid() and status = 'pending');

drop policy if exists "authenticated users can submit resources" on public.resources;
create policy "authenticated users can submit resources" on public.resources
for insert to authenticated
with check (uploaded_by = auth.uid() and status = 'pending');

-- Service requests are created only as submitted requests.
drop policy if exists service_requests_insert_own on public.service_requests;
create policy service_requests_insert_own on public.service_requests
for insert to authenticated
with check (user_id = auth.uid() and status = 'submitted');

commit;
