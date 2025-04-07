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
]
