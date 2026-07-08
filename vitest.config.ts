import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      'sh-syntax': new URL('src', import.meta.url).pathname,
    },
  },
  test: {
    globals: true,
    coverage: {
      enabled: true,
      include: ['src'],
      exclude: ['**/*.json'],
      provider: 'istanbul',
      reporter: ['lcov', 'json', 'text'],
    },
  },
})
