-- Reconcile legacy attempts that were left in_progress after their authoritative expiry.
update public.cbt_attempts
set status = 'expired',
    updated_at = now()
where status = 'in_progress'
  and expires_at is not null
  and expires_at <= now();
