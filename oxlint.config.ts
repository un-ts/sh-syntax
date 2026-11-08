import { defineConfig } from '@1stg/oxlint-config'

export default defineConfig({
  ignorePatterns: ['shell/**', 'test/fixtures/**', 'vendors/**'],
  overrides: [
    {
      files: ['src/browser.ts', 'src/index.ts'],
      rules: {
        'import/no-unassigned-import': 'off',
      },
    },
    {
      files: ['src/types.ts'],
      rules: {
        'no-magic-numbers': 'off',
      },
    },
    {
      files: ['src/processor.ts'],
      rules: {
        'no-undef': 'off',
      },
    },
    {
      files: ['test/syntax.spec.ts'],
      rules: {
        'no-magic-numbers': 'off',
      },
    },
    {
      files: ['test/fixtures.ts'],
      rules: {
        'no-await-in-loop': 'off',
      },
    },
    {
      files: ['test/**'],
      rules: {
        'vitest/prefer-snapshot-hint': 'off',
      },
    },
  ],
  rules: {
    'no-redeclare': 'off',
    eqeqeq: ['error', 'smart'],
  },
})
