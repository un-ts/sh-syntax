import { readFileSync } from 'node:fs'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    {
      name: 'wasm-module',
      enforce: 'pre',
      load(id) {
        if (!id.endsWith('.wasm')) {
          return
        }
        const bytes = readFileSync(id).toString('base64')
        return `const bytes = Uint8Array.from(atob(${JSON.stringify(bytes)}), char => char.charCodeAt(0));\nexport default new WebAssembly.Module(bytes)`
      },
    },
  ],
  test: {
    globals: true,
    include: ['test/**/*.spec.ts'],
    coverage: {
      enabled: true,
      include: ['src/**/*.ts'],
      provider: 'istanbul',
      reporter: ['lcov', 'json', 'text'],
    },
  },
})
