import { randomFillSync } from 'crypto'
import fs from 'fs'
import { performance } from 'perf_hooks'

globalThis.fs = fs
globalThis.crypto = {
  // @ts-expect-error
  getRandomValues: randomFillSync,
}
// @ts-expect-error
globalThis.performance = performance
