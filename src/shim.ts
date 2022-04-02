import { randomFillSync } from 'crypto'
import _fs from 'fs'
import { performance } from 'perf_hooks'

globalThis.fs = _fs
globalThis.crypto = {
  // @ts-expect-error
  getRandomValues: randomFillSync,
}
// @ts-expect-error
globalThis.performance = performance
