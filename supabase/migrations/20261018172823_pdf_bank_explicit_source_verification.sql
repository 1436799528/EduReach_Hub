-- Keep the applied production schema in step with the repository.
alter table public.document_bank
  add column if not exists source_verified boolean not null default false;

comment on column public.document_bank.source_verified is
  'Explicit editorial confirmation that document provenance, exam body, subject, year and institution mapping have been checked. Uploading/routing alone must not certify a past paper.';
