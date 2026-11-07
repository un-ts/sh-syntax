import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      'sh-syntax': new URL('src', import.meta.url).pathname,
    },
  },
  test: {
    globals: true,
    include: ['test/**/*.spec.ts'],
    coverage: {
      enabled: true,
      include: ['src/*.ts'],
      provider: 'istanbul',
      reporter: ['lcov', 'json', 'text'],
    },
  },
})
