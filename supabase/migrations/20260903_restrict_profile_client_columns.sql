begin;

revoke update on table public.profiles from authenticated;
grant update (full_name, school, faculty, department, level, session, matric_number) on table public.profiles to authenticated;
revoke insert on table public.profiles from authenticated;
grant insert (id, full_name, school, faculty, department, level, session, matric_number) on table public.profiles to authenticated;

commit;
