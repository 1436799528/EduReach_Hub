-- Preserve the candidate's current question when a signed-in CBT attempt is resumed.
-- The value is zero-based to match the client question array.
begin;

alter table public.cbt_attempts
  add column if not exists current_question integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cbt_attempts_current_question_check'
      and conrelid = 'public.cbt_attempts'::regclass
  ) then
    alter table public.cbt_attempts
      add constraint cbt_attempts_current_question_check check (current_question >= 0);
  end if;
end $$;

commit;
