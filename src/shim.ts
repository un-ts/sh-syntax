/* eslint-disable @typescript-eslint/no-unnecessary-condition */

import { randomFillSync } from 'node:crypto'
import _fs from 'node:fs'
import { performance } from 'node:perf_hooks'

if (!globalThis.fs) {
  globalThis.fs = _fs
}

if (!globalThis.crypto) {
  globalThis.crypto = {
    // @ts-expect-error -- incompatible types
    getRandomValues: randomFillSync,
  }
}

if (!globalThis.performance) {
  // @ts-expect-error -- incompatible types
  globalThis.performance = performance
}
