-- Retire the former scratch-card inventory service from the active catalogue.
-- The product now provides result-checking guidance only; no card, voucher or
-- PIN inventory is exposed by the application. Keep historical requests intact
-- for audit purposes, but do not advertise or accept new requests for this key.
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
