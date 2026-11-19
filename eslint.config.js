// ESLint configuration (flat config, ESLint 10).
//
// Scope of this setup: catch real defects — unused code, unsafe TypeScript
// patterns, broken hook usage, obvious mistakes — without imposing a style
// opinion. Formatting is Prettier's job (see .prettierrc.json) and
// `eslint-config-prettier` turns off every rule that would fight it.
//
// Everything here is a rule the repository can satisfy today; rules that would
// require rewriting working code are listed as deliberate exceptions in
// CONTRIBUTING.md instead of being enabled and silenced.

import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    // Generated, vendored and non-JavaScript trees. SQL migrations are not
    // parsed by ESLint, and docs are prose.
    ignores: [
      'build/**',
      'dist/**',
      'coverage/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'docs/**',
      'supabase/**',
    ],
  },

  js.configs.recommended,

  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['**/*.{ts,tsx}'],
  })),

  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // tsconfig already fails on unused locals; this catches what it cannot see
      // (unused imports in files the compiler is still happy with, unused
      // arguments after a signature change). `_`-prefixed names are the existing
      // convention for deliberately unused parameters.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
          ignoreRestSiblings: true,
        },
      ],
      // `any` is a real gap in type safety, but the Supabase row shapes and the
      // Express handler boundaries legitimately need it in places. Warning keeps
      // it visible without forcing a rewrite of working code.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Prefer const: a `let` that is never reassigned is a bug waiting to
      // happen and is always safe to narrow.
      'prefer-const': ['error', { destructuring: 'all' }],
      // `==` is allowed only where it is intentional and safe: `== null`.
      eqeqeq: ['error', 'smart'],
      'no-var': 'error',
      // Server, scripts and tests log on purpose; console use is not a defect
      // in this codebase.
      'no-console': 'off',
      // Empty blocks hide failures. An empty catch must say why it is empty.
      'no-empty': ['error', { allowEmptyCatch: false }],
    },
  },

  {
    // React: Rules of Hooks is an error (it is a real defect class); the
    // dependency check is a warning because several effects deliberately run on
    // a narrower dependency list, and each of those carries a written
    // justification at the call site.
    //
    // The plugin's `recommended` preset in v7 also turns on the React Compiler
    // rule set (set-state-in-effect, refs, purity, immutability). Those describe
    // a different component architecture than this application has; enabling
    // them would mean rewriting working screens, which is out of scope. They are
    // a deliberate, documented exception.
    files: ['src/**/*.{ts,tsx}', 'pages/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  {
    // Plain JavaScript that runs outside the TypeScript build: node entry
    // points, rehearsal scripts and test harnesses.
    files: ['**/*.mjs', 'scripts/**/*.js'],
    // Both runtimes: these harnesses run under Node but drive a real browser
    // (Playwright) and evaluate snippets inside the page, so `document`,
    // `window` and `indexedDB` are legitimate identifiers here.
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },

  {
    // The k6 load scripts run inside the k6 runtime, not Node.
    files: ['scripts/load/k6/**/*.js'],
    languageOptions: {
      globals: {
        __ENV: 'readonly',
        __VU: 'readonly',
        __ITER: 'readonly',
        http: 'readonly',
        check: 'readonly',
        sleep: 'readonly',
        group: 'readonly',
        fail: 'readonly',
      },
    },
  },

  {
    // The service worker is a browser worker: `self`, `caches` and `clients`
    // are its runtime, not globals that need declaring in the app bundle.
    files: ['public/sw.js'],
    languageOptions: { globals: { ...globals.serviceworker, ...globals.browser } },
  },

  {
    // Test doubles stand in for Supabase responses and Express objects. `any`
    // there is the point of a fake, not a gap in type safety, so the rule is
    // off rather than warned about on every run.
    files: ['tests/**/*.ts', 'tests/e2e/**/*.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },

  // Must stay last: turns off every rule that would conflict with Prettier.
  prettier,
);
