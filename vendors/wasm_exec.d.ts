/* eslint-disable unicorn/filename-case */
import _fs from 'fs'

import type { IParseError, ShProcessing } from 'sh-syntax'

declare global {
  namespace globalThis {
    // eslint-disable-next-line no-var
    var fs: typeof _fs

    class Go {
      static __shProcessing?: Record<string, ShProcessing>

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
