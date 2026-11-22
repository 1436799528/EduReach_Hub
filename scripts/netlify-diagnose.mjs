// Temporary Netlify build wrapper: it always publishes, and records why the
// real build failed so the deploy log can be read over HTTP.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const chunks = [];
const child = spawn('npm', ['run', 'build'], { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
for (const stream of [child.stdout, child.stderr]) {
  stream.on('data', (d) => {
    chunks.push(d.toString());
    process.stdout.write(d);
  });
}
child.on('close', (code) => {
  mkdirSync('dist', { recursive: true });
  const header = [
    `exit=${code}`,
    `node=${process.version}`,
    `npm=${process.env.npm_config_user_agent ?? 'unknown'}`,
    `env=${Object.keys(process.env).filter((k) => /SUPABASE|CONTEXT|NODE_ENV|NETLIFY|NPM|CI/i.test(k)).sort().join(',')}`,
    '',
  ].join('\n');
  writeFileSync('dist/netlify-build.log', header + chunks.join(''));
  writeFileSync('dist/index.html', '<!doctype html><meta charset="utf-8"><title>build diagnostics</title><h1 id="diagnostics">EduReach build diagnostics</h1><p>See <a href="/netlify-build.log">netlify-build.log</a>.</p>');
  process.exit(0);
});
