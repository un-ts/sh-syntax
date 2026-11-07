import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      'sh-syntax': new URL('src', import.meta.url).pathname,
    },
  },
  test: {
    globals: true,
    exclude: [...configDefaults.exclude, 'shell/**'],
    coverage: {
      enabled: true,
      include: ['src'],
      exclude: ['**/*.json', '**/@eaDir/**', 'shell/**'],
      provider: 'istanbul',
      reporter: ['lcov', 'json', 'text'],
    },
  },
})
