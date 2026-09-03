begin;

drop policy if exists service_requests_read_staff on public.service_requests;
drop policy if exists service_requests_update_staff on public.service_requests;
create policy service_requests_read_staff on public.service_requests
for select to authenticated
using (public.is_staff(auth.uid()));
create policy service_requests_update_staff on public.service_requests
for update to authenticated
using (public.is_staff(auth.uid()))
with check (public.is_staff(auth.uid()));

commit;
