import base from '@1stg/eslint-config'
import stylistic from '@stylistic/eslint-plugin'

const baseConfig = await base

export default [
  ...baseConfig,
  {
    ignores: ['vendors', 'shell'],
  },
  {
    plugins: {
      '@stylistic': stylistic,
    },
    rules: {
      '@stylistic/multiline-comment-style': ['error', 'starred-block'],
    },
  },
  {
    files: ['test/{fixtures,processor}.spec.ts'],
    rules: {
      'sonarjs/no-empty-test-file': 'off',
    },
  },
]
