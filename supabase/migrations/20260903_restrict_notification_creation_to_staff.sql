begin;

drop policy if exists notifications_admin_insert on public.edureach_notifications;
create policy notifications_staff_insert on public.edureach_notifications
for insert to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin','super_admin','moderator','senate_admin','campus_agent')
  )
);

commit;
