import _fs from 'fs'

import { IParseError, ParseResult } from 'sh-syntax'

declare global {
  namespace globalThis {
    var fs: typeof _fs

    class Go {
      static readonly __shProcessing: Record<string, ParseResult>

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
