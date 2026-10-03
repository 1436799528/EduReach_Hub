-- Backend security hardening for public helper functions.
-- Keep immutable helpers on a fixed search_path and remove anonymous execution
-- from authenticated-only CBT availability. Past-question coverage is public
-- read-only data and therefore does not need SECURITY DEFINER.

alter function public.cbt_limits() set search_path = pg_catalog;
alter function public.news_category_slug(text) set search_path = pg_catalog;
revoke execute on function public.cbt_subject_availability(uuid) from anon;
alter function public.cbt_subject_availability(uuid) set search_path = pg_catalog, public;
alter function public.past_question_coverage(text) set search_path = pg_catalog, public;
alter function public.past_question_coverage(text) security invoker;
