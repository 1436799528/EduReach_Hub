-- UI-5: an opt-in public profile link.
--
-- The repository already had a private /profile route, so a copied link sent a
-- visitor to a login wall. This migration adds the smallest model that makes a
-- shareable public profile honest:
--
--   * `public_profile` is false by default. Nothing is public until the student
--     turns it on in their own profile.
--   * `public_profile_slug` is a random, URL-safe handle. It is not the user id
--     and not a derived full name, so the URL does not expose an internal key.
--   * the browser may update exactly these two columns. Reads for visitors go
--     through the same-origin API, which projects an explicit whitelist; no
--     anonymous SELECT policy is added here.
--
-- Contact details, matric number, JAMB registration number, results and
-- notifications are never part of the public projection.

alter table public.profiles
  add column if not exists public_profile boolean not null default false,
  add column if not exists public_profile_slug text;

alter table public.profiles
  drop constraint if exists profiles_public_profile_slug_format;

alter table public.profiles
  add constraint profiles_public_profile_slug_format
  check (
    public_profile_slug is null
    or public_profile_slug ~ '^[a-z0-9][a-z0-9-]{5,31}$'
  );

create unique index if not exists profiles_public_profile_slug_key
  on public.profiles (public_profile_slug)
  where public_profile_slug is not null;

grant update (public_profile, public_profile_slug) on table public.profiles to authenticated;
