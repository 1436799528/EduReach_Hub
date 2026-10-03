-- The paper getter also expires stale attempts, so it is a write-capable
-- function. PostgreSQL forbids row locks and updates inside STABLE functions.
-- Keep the read API owner-scoped, but correctly declare it VOLATILE so expiry
-- enforcement and SELECT ... FOR UPDATE work as intended.
alter function public.get_cbt_attempt_paper(uuid) volatile;
