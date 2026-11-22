import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { hasPrivilegedClientValue } from './scripts/client-secret-guard';
import { clientSupabaseEnv } from './scripts/client-env-check';

export default defineConfig(({ mode }) => {
  // Hosts such as Netlify commonly hold the public project URL and anon key
  // under their unprefixed names. Vite only inlines `VITE_*`, so without this
  // the browser bundle looked unconfigured even though the deployment had the
  // values; the build then refused to publish. Only the two public values are
  // inlined, and a privileged key is still refused below.
  const client = clientSupabaseEnv({ ...loadEnv(mode, process.cwd(), ''), ...process.env });
  const define: Record<string, string> = {};
  if (client.url) define['import.meta.env.VITE_SUPABASE_URL'] = JSON.stringify(client.url);
  if (client.key) {
    define['import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY'] = JSON.stringify(client.key);
    define['import.meta.env.VITE_SUPABASE_ANON_KEY'] = JSON.stringify(client.key);
  }

  return {
    define,
    plugins: [
      react(),
      {
        name: 'reject-privileged-client-values',
        // Vite has already loaded the selected mode's env files and applied its
        // precedence rules here, but has not yet bundled or served client code.
        configResolved(config) {
          if (hasPrivilegedClientValue(config.env)) {
            throw new Error(
              'A privileged Supabase key was found in client-exposed configuration. Remove it from VITE_ variables before starting Vite.',
            );
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      // Build-only minification reduces shipped bytes without changing the budgets.
      minify: 'terser' as const,
      // Keep the shipped bundle inside the static first-load budget. These are
      // semantics-preserving terser passes; error logging is deliberately kept.
      terserOptions: {
        compress: {
          passes: 3,
          hoist_funs: true,
          inline: 3,
          reduce_vars: true,
          pure_getters: true,
          toplevel: true,
          ecma: 2020,
          drop_console: true,
        },
        mangle: { toplevel: true },
      },
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          // Group lazy admin screens for better cross-screen compression. The
          // group remains dynamically loaded, outside the public critical path.
          onlyExplicitManualChunks: true,
          manualChunks(id) {
            if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react';
            if (id.includes('/node_modules/@supabase/')) return 'supabase';
            if (/\/pages\/Admin[^/]+Page\.tsx$/.test(id)) return 'admin-pages';
            if (
              /\/lucide-react\/dist\/esm\/icons\/(check|plus|upload|download|external-link|pencil|eye|lock)\.js$/.test(
                id,
              )
            )
              return 'shared-icons';
          },
        },
      },
    },
    server: {
      allowedHosts: true as const,
      // HMR can be disabled in environments that set DISABLE_HMR.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
