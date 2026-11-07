import { spawn } from 'node:child_process'
import fs from 'node:fs'
import { createInterface } from 'node:readline'
import { createRequire } from 'node:module'

const mode = process.argv[2]
const n = Number(process.argv[3] ?? 2000)
const require = createRequire(import.meta.url)

const rssMiB = pid => {
  const statm = fs.readFileSync(`/proc/${pid}/statm`, 'utf8').split(' ')
  return (Number(statm[1]) * 4096) / 1024 / 1024
}

if (mode === 'daemon') {
  const child = spawn('./native/sh-syntax-native', ['--server'], {
    stdio: ['pipe', 'pipe', 'inherit'],
  })
  const queue = []
  createInterface({ input: child.stdout }).on('line', line => {
    queue.shift()?.(line)
  })
  const request = text =>
    new Promise((resolve, reject) => {
      queue.push(line => {
        try {
          resolve(JSON.parse(line).ast)
        } catch (error) {
          reject(error)
        }
      })
      child.stdin.write(`${JSON.stringify({ text, filepath: 'x.sh' })}\n`)
    })

  await request('echo hi\n')
  global.gc?.()
  const beforeParent = process.memoryUsage().rss
  const beforeChild = rssMiB(child.pid)
  for (let i = 0; i < n; i++) await request('echo hi\n')
  global.gc?.()
  const afterParent = process.memoryUsage().rss
  const afterChild = rssMiB(child.pid)
  child.kill()
  console.log(
    JSON.stringify({
      mode,
      n,
      parentDeltaMiB: ((afterParent - beforeParent) / 1024 / 1024).toFixed(1),
      childDeltaMiB: (afterChild - beforeChild).toFixed(1),
      parentRssMiB: (afterParent / 1024 / 1024).toFixed(1),
      childRssMiB: afterChild.toFixed(1),
    }),
  )
  process.exit(0)
}

let parse
if (mode === 'napi') {
  const binding = require('./linux-x64-gnu/build/Release/sh_syntax_binding.node')
  parse = () => JSON.parse(binding.parse('echo hi\n', 'x.sh')).ast
} else {
  throw new Error(`Unknown mode: ${mode}`)
}

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
