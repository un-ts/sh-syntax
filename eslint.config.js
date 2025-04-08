import base from '@1stg/eslint-config'
import stylisticJs from '@stylistic/eslint-plugin-js'

export default [
  ...base,
  {
    ignores: ['vendors'],
  },
  {
    plugins: {
      '@stylistic/js': stylisticJs,
    },
    rules: {
      '@stylistic/js/multiline-comment-style': ['error', 'starred-block'],
    },
  },
  {
    files: ['test/{fixtures,processor}.spec.ts'],
    rules: {
      'sonarjs/no-empty-test-file': 'off',
    },
  },
]
