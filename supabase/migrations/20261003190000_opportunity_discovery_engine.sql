-- Opportunity discovery engine: structured discovery metadata.
-- Keeps existing opportunity records intact; all new fields are nullable/defaulted.

alter table public.opportunities
  add column if not exists subcategory text,
  add column if not exists education_levels text[] not null default '{}',
  add column if not exists disciplines text[] not null default '{}',
  add column if not exists work_mode text,
  add column if not exists is_featured boolean not null default false;

comment on column public.opportunities.subcategory is 'Optional second-level category, e.g. undergraduate scholarship, engineering internship.';
comment on column public.opportunities.education_levels is 'Normalized education/career levels relevant to the opportunity.';
comment on column public.opportunities.disciplines is 'Normalized study/career disciplines relevant to the opportunity.';
comment on column public.opportunities.work_mode is 'Work/study mode such as remote, onsite, hybrid, or not specified.';
comment on column public.opportunities.is_featured is 'Editorially featured discovery flag; does not imply verification.';

create index if not exists opportunities_discovery_category_idx
  on public.opportunities (category, is_active, deadline);

create index if not exists opportunities_discovery_featured_idx
  on public.opportunities (is_featured, is_active, deadline);
