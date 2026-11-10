import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

// A narrowly scoped feasibility experiment, NOT a migration, integration
// test, platform privilege proof, or substitute for auditing real writers.
// In particular SET ROLE from a postgres superuser session is not a realistic
// PostgREST role test: session_user would retain superuser powers.
test('invoker-context fence distinguishes a narrow definer from legacy and direct writers', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role cbt_test_authenticator nologin noinherit;
      create role cbt_test_authenticated nologin;
      create role cbt_test_service nologin;
      create role cbt_test_executor nologin noinherit;
      grant cbt_test_authenticated, cbt_test_service to cbt_test_authenticator;
      create table public.cbt_test_fence (id integer primary key, protocol integer not null, answer integer);
      insert into public.cbt_test_fence values (1,1,0),(2,2,0);
      grant select, update on public.cbt_test_fence to cbt_test_authenticated, cbt_test_service, cbt_test_executor;
      create function public.cbt_test_guard() returns trigger language plpgsql as $f$
      begin
        if old.protocol=2 and current_user <> 'cbt_test_executor' then raise exception 'v2 fence refused'; end if;
        return new;
      end $f$;
      create trigger cbt_test_fence_trigger before update on public.cbt_test_fence for each row execute function public.cbt_test_guard();
      create function public.cbt_test_legacy(p integer) returns void language plpgsql security definer set search_path='' as $f$
      begin update public.cbt_test_fence set answer=1 where id=p; end $f$;
      create function public.cbt_test_v2(p integer) returns void language plpgsql security definer set search_path='' as $f$
      begin update public.cbt_test_fence set answer=2 where id=p; end $f$;
      alter function public.cbt_test_v2(integer) owner to cbt_test_executor;
    `);
    // Model an authenticator which can assume API roles but is not a member of
    // the narrow definer role. Use SET SESSION AUTHORIZATION, not SET ROLE from
    // a superuser, to make role-assumption checks meaningful.
    await db.exec('set session authorization cbt_test_authenticator');
    try {
      for (const role of ['cbt_test_authenticated', 'cbt_test_service']) {
        await db.exec(`set role ${role}`);
        await db.exec('update public.cbt_test_fence set answer=3 where id=1');
        await assert.rejects(db.exec('update public.cbt_test_fence set answer=3 where id=2'), /v2 fence refused/);
        await assert.rejects(db.exec('select public.cbt_test_legacy(2)'), /v2 fence refused/);
        await assert.rejects(db.exec('set role cbt_test_executor'), /permission denied/i);
        await db.exec("select set_config('request.cbt_executor','cbt_test_executor',false)");
        await assert.rejects(db.exec('update public.cbt_test_fence set answer=4 where id=2'), /v2 fence refused/);
        await db.exec('select public.cbt_test_v2(2)');
        assert.deepEqual((await db.query('select id,answer from public.cbt_test_fence order by id')).rows, [{ id: 1, answer: 3 }, { id: 2, answer: 2 }]);
        await db.exec('reset role');
      }
    } finally { await db.exec('reset session authorization'); }
  } finally { await db.close(); }
});
