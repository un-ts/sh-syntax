import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/sync/index.ts'],
  format: ['cjs'],
  outDir: 'lib',
  clean: false,
  deps: {
    neverBundle: ['../vendors/wasm_exec.cjs', '../../vendors/wasm_exec.cjs'],
  },
})
