import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  plugins: [react()],
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
        // Stable vendor chunks so a redeploy does not invalidate React/Supabase in the browser cache.
        manualChunks: {
          react: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
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
