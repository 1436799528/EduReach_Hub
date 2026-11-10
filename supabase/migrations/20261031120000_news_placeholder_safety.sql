-- News placeholder metadata. No content is inserted by this migration.
-- A database constraint protects every writer, including the generic CMS and
-- privileged server endpoints; a placeholder must be explicitly converted
-- before it can be published. Existing rows default to non-placeholder.
begin;

alter table public.news_articles
  add column if not exists is_placeholder boolean not null default false,
  add column if not exists placeholder_note text;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.news_articles'::regclass and conname = 'news_placeholder_draft_check') then
    alter table public.news_articles add constraint news_placeholder_draft_check
      check (not is_placeholder or (not published and length(trim(coalesce(placeholder_note, ''))) > 0));
  end if;
end $$;

-- Existing foreign keys may use ON DELETE SET NULL. Refuse to delete a marked
-- placeholder while *any* referencing row exists, rather than altering that row.
-- Unknown/composite foreign keys fail closed until reviewed. The definer sees
-- references hidden from the requesting admin by RLS; identifiers are quoted.
create or replace function public.guard_referenced_news_placeholder_delete()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
declare
  fk record;
  referenced boolean;
begin
  if not old.is_placeholder then return old; end if;
  for fk in
    select n.nspname as schema_name, c.relname as table_name, a.attname as column_name,
           cardinality(k.conkey) as source_columns, cardinality(k.confkey) as target_columns,
           target.attname as target_column
    from pg_constraint k
    join pg_class c on c.oid = k.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    left join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
    left join pg_attribute target on target.attrelid = k.confrelid and target.attnum = k.confkey[1]
    where k.contype = 'f' and k.confrelid = 'public.news_articles'::regclass
  loop
    if fk.source_columns <> 1 or fk.target_columns <> 1 or fk.target_column <> 'id' then
      raise exception 'Placeholder deletion blocked: an unsupported news reference requires review' using errcode = '23503';
    end if;
    execute format('select exists (select 1 from %I.%I where %I = $1)', fk.schema_name, fk.table_name, fk.column_name)
      into referenced using old.id;
    if referenced then
      raise exception 'Placeholder deletion blocked: linked records require review' using errcode = '23503';
    end if;
  end loop;
  return old;
end $$;
revoke all on function public.guard_referenced_news_placeholder_delete() from public;
drop trigger if exists guard_referenced_news_placeholder_delete on public.news_articles;
create trigger guard_referenced_news_placeholder_delete before delete on public.news_articles
  for each row execute function public.guard_referenced_news_placeholder_delete();

comment on column public.news_articles.is_placeholder is
  'Editorial placeholder; must remain unpublished until explicitly replaced.';
comment on column public.news_articles.placeholder_note is
  'Information needed before this placeholder can be replaced with genuine content.';

commit;
