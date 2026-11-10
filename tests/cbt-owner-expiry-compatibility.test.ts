import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { migrationFiles, MIGRATIONS_DIR, SHIM_PATH } from '../scripts/replay';
import { join } from 'node:path';

// Verify the additive expiry migration itself leaves pre-existing synthetic
// rows and legacy permissions untouched. This is not the v2 cutover migration.
test('additive expiry migration preserves old attempts and legacy grants', async () => {
  const db = new PGlite();
  const migration = '20261104120000_cbt_owner_expiry.sql';
  try {
    await db.exec(readFileSync(SHIM_PATH, 'utf8'));
    for (const file of migrationFiles().filter(name => name !== migration)) await db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
    await db.exec(`
      insert into auth.users(id,email,raw_user_meta_data) values ('91111111-1111-4111-8111-111111111111','old@synthetic.test','{}');
      insert into public.cbt_exams(id,title,exam_body,subject,description,duration_minutes,is_active)
        select v.id::uuid,'Synthetic','WAEC','Mathematics','test',30,true from (values
          ('92111111-1111-4111-8111-111111111111'),('92222222-2222-4222-8222-222222222222'),
          ('92333333-3333-4333-8333-333333333333'),('92444444-4444-4444-8444-444444444444'),('92555555-5555-4555-8555-555555555555')) v(id);
      insert into public.cbt_attempts(id,user_id,exam_id,status,expires_at,total_questions,answers_draft,score) values
        ('93111111-1111-4111-8111-111111111111','91111111-1111-4111-8111-111111111111','92111111-1111-4111-8111-111111111111','in_progress',now()+interval '30 minutes',1,'{"1":0}',null),
        ('93222222-2222-4222-8222-222222222222','91111111-1111-4111-8111-111111111111','92222222-2222-4222-8222-222222222222','in_progress',now()+interval '30 minutes',1,'{}',null),
        ('93333333-3333-4333-8333-333333333333','91111111-1111-4111-8111-111111111111','92333333-3333-4333-8333-333333333333','in_progress',now()+interval '30 minutes',1,'{"1":"malformed"}',null),
        ('93444444-4444-4444-8444-444444444444','91111111-1111-4111-8111-111111111111','92444444-4444-4444-8444-444444444444','expired',now()-interval '1 day',1,'{"1":1}',null),
        ('93555555-5555-4555-8555-555555555555','91111111-1111-4111-8111-111111111111','92555555-5555-4555-8555-555555555555','submitted',now()-interval '1 day',1,'{}',75);
    `);
    const records = () => db.query('select id,status,expires_at,total_questions,answers_draft,score,updated_at from public.cbt_attempts order by id');
    const grants = () => db.query(`select
      has_function_privilege('authenticated','public.save_cbt_attempt_draft(uuid,jsonb,integer)','execute') as legacy_save,
      has_function_privilege('authenticated','public.submit_cbt_attempt_configured(uuid,jsonb)','execute') as legacy_submit,
      has_function_privilege('service_role','public.submit_cbt_attempt(uuid,uuid,jsonb)','execute') as service_legacy_submit,
      has_table_privilege('service_role','public.cbt_attempts','update') as service_update`);
    const structure = () => db.query(`select 'index:'||indexname as name from pg_indexes where schemaname='public' and tablename in ('cbt_attempts','cbt_answers')
      union all select 'trigger:'||tgname from pg_trigger where tgrelid in ('public.cbt_attempts'::regclass,'public.cbt_answers'::regclass) and not tgisinternal order by name`);
    const before = { rows: (await records()).rows, grants: (await grants()).rows, structure: (await structure()).rows };
    await db.exec(readFileSync(join(MIGRATIONS_DIR, migration), 'utf8'));
    assert.deepEqual((await records()).rows, before.rows);
    assert.deepEqual((await grants()).rows, before.grants);
    assert.deepEqual((await structure()).rows, before.structure);
    // Local platform shims are not the live privilege model: service_role has
    // no inherited EXECUTE on the old scorer in this replay, unlike the live
    // metadata observed in Phase 2. Verify both unchanged and documented here.
    assert.deepEqual(before.grants[0], { legacy_save: true, legacy_submit: true, service_legacy_submit: false, service_update: true });
  } finally { await db.close(); }
});
