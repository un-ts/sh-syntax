import { randomFillSync } from 'node:crypto'
import _fs from 'node:fs'
import { performance } from 'node:perf_hooks'

globalThis.fs = _fs
if (!globalThis.crypto) {
  globalThis.crypto = {
    // @ts-expect-error
    getRandomValues: randomFillSync,
  }
}
// @ts-expect-error
globalThis.performance = performance
