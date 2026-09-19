-- Remove the redundant legacy auth trigger introduced by older profile flows.
-- The canonical EduReach auth triggers are on_auth_user_created_edureach
-- and on_auth_user_created_wallet.

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
