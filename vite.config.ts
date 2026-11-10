import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { hasPrivilegedClientValue } from './scripts/client-secret-guard';

export default defineConfig(() => ({
  plugins: [react(), {
    name: 'reject-privileged-client-values',
    // Vite has already loaded the selected mode's env files and applied its
    // precedence rules here, but has not yet bundled or served client code.
    configResolved(config) {
      if (hasPrivilegedClientValue(config.env)) {
        throw new Error('A privileged Supabase key was found in client-exposed configuration. Remove it from VITE_ variables before starting Vite.');
      }
    },
  }],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    // Build-only minification reduces shipped bytes without changing the budgets.
    minify: 'terser' as const,
    // Hoist same-scope declarations and limit function inlining to reduce
    // emitted bytes without weakening runtime validation or raising budgets.
    terserOptions: { compress: { passes: 2, hoist_funs: true, inline: 1 } },
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
          if (/\/lucide-react\/dist\/esm\/icons\/(check|plus|upload|download|external-link|pencil|eye|lock)\.js$/.test(id)) return 'shared-icons';
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
}));
