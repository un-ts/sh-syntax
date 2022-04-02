import _fs from 'fs'

declare global {
  namespace globalThis {
    var fs: typeof _fs

    class Go {
      static __shProcessing: Record<
        number,
        | {
            error:
              | string
              | {
                  filename: string
                  incomplete: boolean
                  text: string
                  pos: {
                    col: number
                    line: number
                    offset: number
                  }
                  message: string
                }
          }
        | { text: string }
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
