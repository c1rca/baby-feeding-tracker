import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'data', 'data-dev', 'data-browser', 'backups', 'rollback', 'logs', 'test-results']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  // The backend, build scripts, and Node test suite were previously matched by
  // no config block at all, so ~2000 lines of auth, validation, and SQL had no
  // static checking whatsoever.
  {
    files: ['server/**/*.js', 'scripts/**/*.mjs', 'test/**/*.mjs', 'server.js', '*.config.js', '*.config.ts'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: { ...globals.node },
      ecmaVersion: 2023,
      sourceType: 'module',
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['public/sw.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: { ...globals.serviceworker },
      ecmaVersion: 2023,
      sourceType: 'script',
    },
  },
])
