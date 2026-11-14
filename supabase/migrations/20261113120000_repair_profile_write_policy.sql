-- UX-1 — restore the staff predicate used by student-facing write policies.
--
-- `public.is_staff(uuid)` was created outside this repository and had EXECUTE
-- revoked from `authenticated`. PostgreSQL still evaluates every permissive
-- policy that applies to an UPDATE, so the unexecutable staff policy made an
-- otherwise valid student UPDATE fail with `42501: permission denied for
-- function is_staff`. The profile page reported an error, and no row changed.
--
-- Both overloads are redefined with the same role list and the same caller
-- rule: when a signed-in user calls the function, it only answers for that
-- user. The uuid argument is ignored for authenticated callers, so granting
-- EXECUTE does not create a "is this UUID an administrator?" oracle. Service
-- role callers can still ask about another user.
--
-- NOTE: this is intentionally additive and idempotent. It does not widen table
-- grants, change RLS role checks, or let a student update another student.

create or replace function public.is_staff(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = coalesce(auth.uid(), p_user_id)
      and p.role in ('moderator', 'admin', 'super_admin', 'contributor', 'content_editor', 'service_admin')
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('moderator', 'admin', 'super_admin', 'contributor', 'content_editor', 'service_admin')
  );
$$;

revoke all on function public.is_staff(uuid) from public, anon;
revoke all on function public.is_staff() from public, anon;

grant execute on function public.is_staff(uuid) to authenticated, service_role;
grant execute on function public.is_staff() to authenticated, service_role;
