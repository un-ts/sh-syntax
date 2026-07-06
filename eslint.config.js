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
  {
    /*
     * `LangVariant` mirrors mvdan/sh's `1 << iota` bit flags, so its values are
     * intentional rather than magic numbers.
     */
    files: ['src/types.ts'],
    rules: {
      '@typescript-eslint/no-magic-numbers': 'off',
    },
  },
]
