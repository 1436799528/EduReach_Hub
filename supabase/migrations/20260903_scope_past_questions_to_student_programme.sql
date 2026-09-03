begin;

drop policy if exists "authenticated users can read approved past questions" on public.past_questions;
create policy "students read relevant approved past questions" on public.past_questions
for select to authenticated
using (
  uploaded_by = auth.uid()
  or public.is_staff(auth.uid())
  or (
    status = 'approved'
    and exists (
      select 1
      from public.courses c
      join public.profiles p on p.programme_id = c.programme_id
      where c.id = past_questions.course_id
        and p.id = auth.uid()
    )
  )
);

commit;
