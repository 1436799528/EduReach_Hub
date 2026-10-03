-- OPP-1 — the fields needed to describe a student opportunity honestly.
--
-- The page header claimed that "source, eligibility and application route have
-- been checked" for every listing, but the table had nowhere to record
-- eligibility, and the public route did not read `source_name` even though the
-- newsroom migration had already added it. Two consequences were live:
--
--   * a listing with `last_verified_at is null` still read as confidently
--     active, because nothing on the card contradicted it;
--   * "eligibility has been checked" could never be true, because no column
--     existed to hold it.
--
-- This migration adds the missing column. It deliberately does not backfill it:
-- there is no authoritative eligibility data to backfill from, and inventing it
-- is exactly what this project must not do. Until an operator records it, the
-- listing says so.
--
-- Verification itself is already governed by `last_verified_at`
-- (20260930120000_newsroom_ingestion_pipeline.sql) and is not duplicated here.

alter table public.opportunities
  add column if not exists eligibility text;

comment on column public.opportunities.eligibility is
  'Who may apply, in the organiser''s own words. Null means EduReach has not recorded it; the public listing says so rather than implying it was checked.';

-- Nothing else changes: reads and writes are already granted to the right roles
-- by 20260926220000_admin_full_catalogue_opportunities.sql.
