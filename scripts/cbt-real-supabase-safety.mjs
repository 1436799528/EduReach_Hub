// Pure preflight for the real Supabase CBT integration rehearsal.
// This is not proof a project is disposable: an operator must independently
// verify the target, its backup, and exclusive access immediately before use.
const productionRef = 'gjdfatwcoosyuhakrrhh'; // Existing documented production reference.
const unsafeName = /^(?:PG[A-Z0-9_]*|DATABASE(?:_[A-Z0-9_]+)?|DB_[A-Z0-9_]+|POSTGRES(?:_[A-Z0-9_]+)?|SUPABASE(?:_[A-Z0-9_]+)?|VITE_SUPABASE(?:_[A-Z0-9_]+)?|(?:HTTP|HTTPS|ALL|NO)_PROXY|GLOBAL_AGENT_[A-Z0-9_]+|NPM_CONFIG_(?:HTTP_)?PROXY|UNDICI_PROXY|NODE_OPTIONS|NODE_PATH|NODE_DEBUG|NODE_DEBUG_NATIVE|NODE_USE_ENV_PROXY|NODE_EXTRA_CA_CERTS|NODE_TLS_REJECT_UNAUTHORIZED|SSL_CERT_FILE|SSL_CERT_DIR|LD_PRELOAD|DYLD_INSERT_LIBRARIES|DOTENV_CONFIG_[A-Z0-9_]+|NETLIFY(?:_[A-Z0-9_]+)?)$/i;

function refuse(message) { throw new Error(`Real Supabase preflight refused: ${message}`); }
function required(env, name) {
  if (typeof env[name] !== 'string' || !env[name].trim()) refuse(`missing ${name}.`);
  return env[name].trim();
}
function parseUrl(value, label) {
  try { return new URL(value); } catch { return refuse(`invalid ${label}.`); }
}

export function realSupabaseConfig(env) {
  if (String(env.NODE_ENV || '').toLowerCase() === 'production' || String(env.CONTEXT || '').toLowerCase() === 'production') refuse('production execution is forbidden.');
  if (Object.entries(env).some(([name, value]) => unsafeName.test(name) && value !== undefined && value !== '')) refuse('ambient database, Supabase, proxy or preload configuration is forbidden; use a clean environment.');
  const mode = required(env, 'CBT_REAL_TARGET');
  if (mode !== 'local' && mode !== 'staging') refuse('CBT_REAL_TARGET must be local or staging.');
  if (required(env, 'CBT_REAL_DISPOSABLE_ACK') !== 'DEDICATED_EMPTY_DISPOSABLE_PROJECT') refuse('disposable-project acknowledgement missing.');
  if (required(env, 'CBT_REAL_ROLLBACK_ACK') !== 'BACKUP_VERIFIED_AND_ROLLBACK_AUTHORIZED') refuse('backup and rollback acknowledgement missing.');
  if (required(env, 'CBT_REAL_MIGRATIONS_ACK') !== 'RECONCILED_ALL_MIGRATION_FILES_AND_DUPLICATE_VERSIONS') refuse('full migration reconciliation acknowledgement missing.');
  const api = parseUrl(required(env, 'CBT_REAL_SUPABASE_URL'), 'Supabase URL');
  const db = parseUrl(required(env, 'CBT_REAL_DATABASE_URL'), 'database URL');
  if (api.username || api.password || api.search || api.hash || !['', '/'].includes(api.pathname)) refuse('Supabase URL must be an origin without credentials, path or query.');
  if (!['postgres:', 'postgresql:'].includes(db.protocol) || db.pathname !== '/postgres' || db.hash || !db.username) refuse('database URL must name the postgres database and an explicit user.');
  for (const key of db.searchParams.keys()) if (key !== 'sslmode') refuse('database URL connection overrides are not permitted.');
  if (db.searchParams.getAll('sslmode').length > 1) refuse('ambiguous TLS configuration.');
  if (mode === 'local') {
    if (api.protocol !== 'http:' || api.hostname !== '127.0.0.1' || db.hostname !== '127.0.0.1') refuse('local API and database must use loopback 127.0.0.1, without a proxy or tunnel.');
    if (!api.port || !db.port) refuse('local API and database ports must be explicit.');
  } else {
    const ref = required(env, 'CBT_REAL_STAGING_REF').toLowerCase();
    if (required(env, 'CBT_REAL_HOSTED_AUTHORIZATION') !== 'SEPARATELY_AUTHORIZED_HOSTED_TEST_AND_ROLLBACK') refuse('separate hosted mutation and rollback authorization missing.');
    if (!/^[a-z0-9]{20}$/.test(ref) || ref === productionRef) refuse('invalid or prohibited staging project reference.');
    if (api.protocol !== 'https:' || api.port || api.hostname !== `${ref}.supabase.co` || db.hostname !== `db.${ref}.supabase.co`) refuse('staging API and direct database hosts must match the explicit staging reference.');
    if (db.searchParams.get('sslmode') !== 'verify-full') refuse('staging database requires sslmode=verify-full.');
  }
  const systemId = required(env, 'CBT_REAL_DB_SYSTEM_ID');
  if (!/^[0-9]{10,25}$/.test(systemId)) refuse('invalid expected PostgreSQL system identifier.');
  const anonKey = required(env, 'CBT_REAL_ANON_KEY');
  const serviceKey = required(env, 'CBT_REAL_SERVICE_KEY');
  if (anonKey === serviceKey) refuse('anonymous and service keys must be distinct.');
  const pgModule = required(env, 'CBT_REAL_PG_MODULE');
  if (!pgModule.startsWith('/') || pgModule.includes('\0')) refuse('CBT_REAL_PG_MODULE must be an absolute local module path.');
  return { mode, api: api.origin, databaseUrl: db.toString(), systemId, anonKey, serviceKey, pgModule };
}
