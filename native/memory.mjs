import { createRequire } from 'node:module'

const mode = process.argv[2]
const n = Number(process.argv[3] ?? 2000)
const require = createRequire(import.meta.url)

let parse
if (mode === 'napi') {
  const binding = require('./linux-x64-gnu/build/Release/sh_syntax_binding.node')
  parse = () => JSON.parse(binding.parse('echo hi\n', 'x.sh')).ast
} else if (mode === 'wasm') {
  const { parseSync } = await import('../lib/index.js')
  parse = () => parseSync('echo hi\n')
} else {
  throw new Error(`Unknown mode: ${mode}`)
}

// Warm up once so module instantiation is not counted in the delta.
parse()
global.gc?.()
const before = process.memoryUsage().rss
for (let i = 0; i < n; i++) parse()
global.gc?.()
const after = process.memoryUsage().rss

console.log(
  JSON.stringify({
    mode,
    n,
    deltaMiB: ((after - before) / 1024 / 1024).toFixed(1),
    rssMiB: (after / 1024 / 1024).toFixed(1),
  }),
)
