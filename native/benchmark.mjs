import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { parseSync } from '../lib/index.js'

const require = createRequire(import.meta.url)
const binding = require('./linux-x64-gnu/build/Release/sh_syntax_binding.node')
const nativeAddon = text => JSON.parse(binding.parse(text, 'bench.sh')).ast
const nativeCli = text => {
  const result = spawnSync('./native/sh-syntax-native', ['bench.sh'], {
    input: text,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  if (result.status !== 0) throw new Error(result.stderr)
  return JSON.parse(result.stdout).ast
}
const wasm = text => parseSync(text, { keepComments: true, filepath: 'bench.sh' })

const bench = (name, fn, n) => {
  for (let i = 0; i < 3; i++) fn()
  const start = performance.now()
  for (let i = 0; i < n; i++) fn()
  return { name, ms: (performance.now() - start) / n }
}

const cases = [
  ['echo hi', 1000],
  [fs.readFileSync('test/fixtures/install.sh', 'utf8'), 10],
]

for (const [text, n] of cases) {
  console.log(`input: ${text.length} bytes`)
  for (const [name, fn] of [
    ['napi', nativeAddon],
    ['wasm', wasm],
    ['cli-spawn', nativeCli],
  ]) {
    const result = bench(name, () => fn(text), n)
    console.log(`${result.name}: ${result.ms.toFixed(1)}ms`)
  }
}
