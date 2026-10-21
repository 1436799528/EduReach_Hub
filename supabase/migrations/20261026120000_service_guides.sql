-- Service guides: admin-managed "how to handle this service" instructions.
--
-- Before this migration the step-by-step guides lived only in
-- src/data/serviceGuides.ts, so correcting a portal step or replacing a
-- screenshot needed a code change and a deploy. The built-in guides in that
-- file remain the default content (and the offline fallback); a row here is
-- an admin-authored override for one service_catalog entry.
--
-- Deliberate choices:
--   * One row per service, steps as a JSONB array: a guide is always edited,
--     reordered and published as a unit, so per-step rows would add joins
--     without buying anything.
--   * `status` keeps unfinished guides away from students: the public API
--     only serves 'published' rows; drafts are read through the admin API.
--   * No client grants at all. Both reads go through the server, which
--     checks `service.read` / `service.update` capabilities before touching
--     the table, so hiding a dashboard button is never the only guard.
--   * Deleting a catalogue service cascades to its guide; deleting a guide
--     row simply restores the built-in default guide.
--   * Built-in application-form services (nelfund-loan, results, jamb-slip,
--     admission-letters) cannot be deleted at the API layer, so their guides
--     and WhatsApp destinations cannot be broken by catalogue deletion.

begin;

create table if not exists public.service_guides (
  service_key text primary key references public.service_catalog(service_key) on delete cascade,
  eyebrow text not null default '',
  summary text not null default '',
  safety_note text not null default '',
  steps jsonb not null default '[]'::jsonb,
  status text not null default 'draft',
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_guides_status_known check (status in ('draft', 'published')),
  constraint service_guides_steps_is_array check (jsonb_typeof(steps) = 'array'),
  constraint service_guides_steps_bounded check (jsonb_array_length(steps) <= 24)
);

comment on table public.service_guides is
  'Admin-authored step-by-step guide overriding the built-in guide in src/data/serviceGuides.ts for one service. Only published rows are served publicly; drafts are admin-only. Steps is a JSON array of {title, body, image, imageAlt, imageKind, imageSource, section?}.';

alter table public.service_guides enable row level security;
revoke all on table public.service_guides from public, anon, authenticated;
grant select, insert, update, delete on table public.service_guides to service_role;

drop trigger if exists service_guides_set_updated_at on public.service_guides;
create trigger service_guides_set_updated_at
before update on public.service_guides
for each row execute function public.set_student_portal_updated_at();

commit;
