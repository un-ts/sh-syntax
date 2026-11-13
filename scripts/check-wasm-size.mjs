import { statSync } from 'node:fs'

const DEFAULT_MAX_BYTES = 4_000_000
const maxBytes = Number(process.env.WASM_MAX_BYTES ?? DEFAULT_MAX_BYTES)
const size = statSync('main.wasm').size
console.log(`main.wasm: ${size} B (budget ${maxBytes} B)`)
if (size > maxBytes) {
  throw new Error(`main.wasm exceeds the ${maxBytes} B budget by ${size - maxBytes} B`)
}
