-- BASE-1: renamed from 20260915_cbt_news_rls.sql.
--
-- This file enables row-level security on the CBT and news tables and defines
-- their policies, but it used to sort BEFORE 20260915_cbt_news_tables.sql,
-- which creates those tables, so it failed on an empty database. The statements
-- are idempotent (enable rls, drop policy if exists + create policy), so
-- re-running it on an existing project changes nothing.

alter table public.cbt_exams enable row level security;
alter table public.exam_questions enable row level security;
alter table public.cbt_attempts enable row level security;
alter table public.cbt_answers enable row level security;
alter table public.news_articles enable row level security;

drop policy if exists "Public can read active CBT exams" on public.cbt_exams;
create policy "Public can read active CBT exams"
on public.cbt_exams for select
to anon, authenticated
using (is_active = true);

drop policy if exists "Public can read exam questions for active exams" on public.exam_questions;
create policy "Public can read exam questions for active exams"
on public.exam_questions for select
to anon, authenticated
using (exists (select 1 from public.cbt_exams e where e.id = exam_id and e.is_active = true));

drop policy if exists "Users can read own CBT attempts" on public.cbt_attempts;
create policy "Users can read own CBT attempts"
on public.cbt_attempts for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create own CBT attempts" on public.cbt_attempts;
create policy "Users can create own CBT attempts"
on public.cbt_attempts for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own CBT attempts" on public.cbt_attempts;
create policy "Users can update own CBT attempts"
on public.cbt_attempts for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read own CBT answers" on public.cbt_answers;
create policy "Users can read own CBT answers"
on public.cbt_answers for select
to authenticated
using (exists (select 1 from public.cbt_attempts a where a.id = attempt_id and a.user_id = (select auth.uid())));

drop policy if exists "Users can create own CBT answers" on public.cbt_answers;
create policy "Users can create own CBT answers"
on public.cbt_answers for insert
to authenticated
with check (exists (select 1 from public.cbt_attempts a where a.id = attempt_id and a.user_id = (select auth.uid())));

drop policy if exists "Users can update own CBT answers" on public.cbt_answers;
create policy "Users can update own CBT answers"
on public.cbt_answers for update
to authenticated
using (exists (select 1 from public.cbt_attempts a where a.id = attempt_id and a.user_id = (select auth.uid())))
with check (exists (select 1 from public.cbt_attempts a where a.id = attempt_id and a.user_id = (select auth.uid())));

drop policy if exists "Public can read published news" on public.news_articles;
create policy "Public can read published news"
on public.news_articles for select
to anon, authenticated
using (published = true);
