// Fail-closed checks for the disposable PostgreSQL rehearsal only. They are
// not an application feature gate and do not establish isolation of a proxy.
const unsafeName = /^(?:PG[A-Z0-9_]*|DATABASE(?:_[A-Z0-9_]+)?|DB_[A-Z0-9_]+|POSTGRES(?:_[A-Z0-9_]+)?|SUPABASE(?:_[A-Z0-9_]+)?|VITE_SUPABASE(?:_[A-Z0-9_]+)?|(?:HTTP|HTTPS|ALL|NO)_PROXY|GLOBAL_AGENT_[A-Z0-9_]+|NPM_CONFIG_(?:HTTP_)?PROXY|UNDICI_PROXY|NODE_OPTIONS|NODE_PATH|NODE_USE_ENV_PROXY|NODE_EXTRA_CA_CERTS|NODE_TLS_REJECT_UNAUTHORIZED|LD_PRELOAD|DYLD_INSERT_LIBRARIES|DOTENV_CONFIG_[A-Z0-9_]+|NETLIFY(?:_[A-Z0-9_]+)?|CBT_V2_LOCAL_REHEARSAL|CBT_V2_TEST_IMPORT)$/i;
const credentialName = /(?:^|_)(?:SECRET|PASSWORD|TOKEN|CREDENTIALS?|API_KEY|PRIVATE_KEY)(?:_|$)/i;

export function assertDisposableEnvironment(env) {
  if (String(env.NODE_ENV || '').toLowerCase() === 'production' || String(env.CONTEXT || '').toLowerCase() === 'production' ||
      Object.entries(env).some(([name, value]) => (unsafeName.test(name) || credentialName.test(name)) && value !== undefined && value !== '')) {
    // Neither environment names nor values are echoed; values can be secrets.
    throw new Error('Disposable CBT rehearsal refused: unsafe configuration.');
  }
}

export function assertDisposableDatabase(identity, dataDirectory, socketDirectory) {
  if (!identity || identity.data_directory !== dataDirectory || identity.socket_directories !== socketDirectory ||
      identity.listen_addresses !== '' || identity.server_address !== null || identity.database_name !== 'postgres') {
    throw new Error('Disposable CBT rehearsal refused: database identity mismatch.');
  }
}
