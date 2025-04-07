/* eslint-disable @typescript-eslint/no-unnecessary-condition */

import { randomFillSync } from 'node:crypto'
import _fs from 'node:fs'
import { performance } from 'node:perf_hooks'

globalThis.fs ??= _fs

globalThis.crypto ??= {
  // @ts-expect-error -- incompatible types
  getRandomValues: randomFillSync,
}

// @ts-expect-error -- incompatible types
globalThis.performance ??= performance
