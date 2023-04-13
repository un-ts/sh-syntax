import path from 'node:path'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      'sh-syntax': path.resolve('src'),
    },
  },
  test: {
    coverage: {
      exclude: ['test', 'vendors'],
      provider: 'istanbul',
      reporter: ['json'],
    },
  },
})
