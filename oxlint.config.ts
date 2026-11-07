import { defineConfig } from '@1stg/oxlint-config'

export default defineConfig({
  ignorePatterns: ['shell/**', 'test/fixtures/**', 'vendors/**'],
  overrides: [
    {
      files: ['src/processor.ts'],
      rules: {
        'no-undef': 'off',
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
