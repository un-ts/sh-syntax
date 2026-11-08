import fs from 'node:fs'
import { gzipSync } from 'node:zlib'

const KIB = 1024
const MIB = 1024 * KIB

const artifacts = [
  ['N-API addon', 'native/linux-x64-gnu/build/Release/sh_syntax_binding.node'],
  ['N-API shared library', 'build/libshsyntax.so'],
  ['native CLI / daemon', 'native/sh-syntax-native'],
  ['WASM fallback', 'main.wasm'],
]

for (const [name, file] of artifacts) {
  const raw = fs.statSync(file).size
  const gzip = gzipSync(fs.readFileSync(file), { level: 9 }).length
  console.log(
    `${name}: ${(raw / MIB).toFixed(2)}MiB raw, ${(gzip / MIB).toFixed(2)}MiB gzip`,
  )
}
