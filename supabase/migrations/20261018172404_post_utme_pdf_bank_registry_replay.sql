-- The same additive schema was applied twice during setup. This migration file
-- records the second idempotent application so repository and production migration
-- histories remain aligned. The schema itself is created by the preceding migration.
select 1;
