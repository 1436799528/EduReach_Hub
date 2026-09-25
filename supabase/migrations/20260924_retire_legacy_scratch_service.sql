-- Retire the former scratch-card inventory service from the active catalogue.
-- The product now provides result-checking guidance only; no card, voucher or
-- PIN inventory is exposed by the application. Keep historical service requests
-- intact for audit purposes, but do not advertise or accept new requests.
update public.service_catalog
set active = false
where service_key = 'scratch-cards';

do $$
begin
  if to_regprocedure('public.claim_service_voucher(uuid, text)') is not null then
    execute 'drop function public.claim_service_voucher(uuid, text)';
  end if;
end
$$;

-- The current admin dashboard no longer reports voucher inventory. Remove those
-- legacy reads from the metrics function so the backend matches the current
-- admin surface and remains independent of the retired voucher subsystem.
create or replace function public.admin_dashboard_metrics()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_users bigint;
  v_admins bigint;
  v_requests bigint;
  v_pending bigint;
  v_completed bigint;
  v_rejected bigint;
  v_cbt_attempts bigint;
  v_cbt_submitted bigint;
  v_avg_score numeric;
  v_events_24h bigint;
  v_sessions_24h bigint;
  v_events_7d bigint;
  v_institutions bigint;
  v_services bigint;
  v_news bigint;
  v_audit bigint;
begin
  select count(*) into v_users from public.profiles;
  select count(*) into v_admins from public.profiles where role in ('admin','super_admin');
  select count(*) into v_requests from public.service_requests;
  select count(*) into v_pending from public.service_requests where status in ('submitted','reviewing','processing');
  select count(*) into v_completed from public.service_requests where status='completed';
  select count(*) into v_rejected from public.service_requests where status in ('rejected','cancelled');
  select count(*) into v_cbt_attempts from public.cbt_attempts;
  select count(*) into v_cbt_submitted from public.cbt_attempts where status='submitted';
  select coalesce(round(avg(score),2),0) into v_avg_score from public.cbt_attempts where status='submitted';
  select count(*) into v_events_24h from public.site_analytics_events where created_at >= now()-interval '24 hours';
  select count(distinct session_id) into v_sessions_24h from public.site_analytics_events where created_at >= now()-interval '24 hours' and session_id is not null;
  select count(*) into v_events_7d from public.site_analytics_events where created_at >= now()-interval '7 days';
  select count(*) into v_institutions from public.institutions;
  select count(*) into v_services from public.service_catalog where active=true;
  select count(*) into v_news from public.news_articles where published=true;
  select count(*) into v_audit from public.edureach_audit_logs;

  return jsonb_build_object(
    'users',v_users,'admins',v_admins,'service_requests',v_requests,'pending_requests',v_pending,
    'completed_requests',v_completed,'rejected_requests',v_rejected,'cbt_attempts',v_cbt_attempts,
    'cbt_submitted',v_cbt_submitted,'average_cbt_score',v_avg_score,'events_24h',v_events_24h,
    'sessions_24h',v_sessions_24h,'events_7d',v_events_7d,'institutions',v_institutions,
    'active_services',v_services,'published_news',v_news,'audit_events',v_audit
  );
end;
$function$;
