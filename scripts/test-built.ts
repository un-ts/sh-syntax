import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const walk = (directory: string): string[] => {
  const files: string[] = []
  const entries = readdirSync(directory, { withFileTypes: true })
  for (const entry of entries) {
    const path = `${directory}/${entry.name}`
    if (entry.isDirectory()) {
      files.push(...walk(path))
    } else {
      files.push(path)
    }
  }
  return files
}

for (const file of walk('lib')) {
  if (!/\.(?:js|cjs)$/.test(file)) {
    continue
  }
  if (/(?:from\s*['"])tslib(?:['"]|\/)|require\(['"]tslib/.test(readFileSync(file, 'utf8'))) {
    throw new Error(`built output imports tslib: ${file}`)
  }
}
interface SyncAPI {
  parse: (text: string) => unknown
  print: (ast: unknown) => string
}

interface AsyncAPI {
  parse: (text: string) => Promise<unknown>
  print: (ast: unknown) => Promise<string>
}

const esmSync = (await import('../lib/sync/index.js')) as SyncAPI
const cjsSync = require('../lib/sync/index.cjs') as SyncAPI
for (const api of [esmSync, cjsSync]) {
  const ast: unknown = api.parse('echo hi\n')
  if (api.print(ast) !== 'echo hi\n') {
    throw new Error('built sync entry failed')
  }
}

const esmAsync = (await import('../lib/index.js')) as AsyncAPI
const ast: unknown = await esmAsync.parse('echo hi\n')
if ((await esmAsync.print(ast)) !== 'echo hi\n') {
  throw new Error('built async entry failed')
}

console.log('built ESM/CJS smoke test passed')
