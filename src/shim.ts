import { randomFillSync } from 'crypto'
import _fs from 'fs'
import { performance } from 'perf_hooks'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace globalThis {
    // eslint-disable-next-line no-var
    var fs: typeof _fs

    class Go {
      static __shProcessing: Record<
        number,
        { error: string } | { text: string }
      >

      _pendingEvent: { id: number }
      argv: string[]
      env: NodeJS.ProcessEnv
      importObject: WebAssembly.Imports
      exited: boolean

      _resume(): void

      exit(code?: number): void

      run(instance: WebAssembly.Instance): Promise<void>
    }
  }
}

globalThis.fs = _fs
globalThis.crypto = {
  // @ts-expect-error
  getRandomValues: randomFillSync,
}
// @ts-expect-error
globalThis.performance = performance
