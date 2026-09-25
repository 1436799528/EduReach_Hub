-- Retire an unused SECURITY DEFINER RPC from the exposed public schema.
-- EduReach no longer calls get_campus_feed_profiles; keeping it executable by
-- authenticated users would expose arbitrary profile lookups outside the app's
-- current data boundary.
revoke all on function public.get_campus_feed_profiles(uuid[]) from public, anon, authenticated;
