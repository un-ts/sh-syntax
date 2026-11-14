import { InputError } from './common.js'
import {
  invoke,
  invokeInteractive,
  invokeSplitBraces,
  startGoRuntime,
  type GoRuntime,
  type InternalOptions,
} from './internal.js'
import {
  type File,
  type PrintableNode,
  type ShInteractiveOptions,
  type ShOptions,
  type ShPrintOptions,
  type SplitBracesResult,
  type AsyncInteractiveParser,
  type Word,
} from './types.js'

export type WebAssemblyBaseSource = Buffer | BufferSource
export type WebAssemblySource =
  | WebAssemblyBaseSource
  | { headers?: { get(name: string): string | null }; arrayBuffer(): Promise<ArrayBuffer> }

export type GetWebAssemblySource = () => Promise<WebAssemblySource> | WebAssemblySource

export type GetWebAssembly =
  | WebAssemblyBaseSource
  | WebAssembly.Module
  | GetWebAssemblySource
  | GetWebAssemblyInstance

export type GetWebAssemblyInstance = (
  imports: WebAssembly.Imports,
) => Promise<WebAssembly.Instance> | WebAssembly.Instance

/** A parser bound to one WASM runtime. */
export interface Processor {
  (text: string, options?: ShOptions): Promise<File>
  (text: string, options?: ShOptions & { print: true }): Promise<string>
  (node: PrintableNode, options?: ShPrintOptions): Promise<string>
  splitBraces: (word: Word) => Promise<SplitBracesResult>
  createInteractiveParser: (options?: ShInteractiveOptions) => AsyncInteractiveParser
  /** Loads and initializes the WASM runtime. Repeated calls share one initialization. */
  init(): Promise<void>
}

/**
 * Creates an async processor. A function with zero parameters is treated as a source loader; a
 * function with parameters is treated as a `(imports) => WebAssembly.Instance` factory.
 */
export const getProcessor = (getWasm: GetWebAssembly): Processor => {
  const isInstanceFactory = typeof getWasm === 'function' && getWasm.length > 0
  let wasmModule: WebAssembly.Module | undefined
  let runtimePromise: Promise<GoRuntime & { startup: Promise<void> }> | undefined
  let initPromise: Promise<void> | undefined
  let ready = false
  let queue: Promise<unknown> = Promise.resolve()

  const loadModule = async (): Promise<WebAssembly.Module> => {
    const source =
      typeof getWasm === 'function'
        ? await (getWasm as GetWebAssemblySource)()
        : (getWasm as WebAssemblyBaseSource)

    if ('arrayBuffer' in source) {
      /*
       * compileStreaming is only safe for a real, same-realm Response.
       * Response-like sources and cross-realm responses use arrayBuffer.
       */
      if (
        typeof WebAssembly.compileStreaming === 'function' &&
        source instanceof Response &&
        source.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() ===
          'application/wasm'
      ) {
        return WebAssembly.compileStreaming(source)
      }

      return WebAssembly.compile(await source.arrayBuffer())
    }

    return WebAssembly.compile(source)
  }

  const createRuntime = async () => {
    // oxlint-disable-next-line no-undef -- Go is defined globally by wasm_exec
    const go = new Go()
    const instance = isInstanceFactory
      ? await (getWasm as GetWebAssemblyInstance)(go.importObject)
      : await WebAssembly.instantiate(wasmModule as WebAssembly.Module, go.importObject)
    const runtime = startGoRuntime(go, instance)

    /*
     * Do not await the program itself: main blocks in select{} until the Go program exits.
     * Surface an immediate startup rejection while treating a still-running program as ready.
     */
    const startup = Promise.race([runtime.run, new Promise<void>(queueMicrotask)])
    return { ...runtime, startup }
  }

  const getRuntime = async () => {
    if (!runtimePromise) {
      const create = async () => {
        try {
          return await createRuntime()
        } catch (error) {
          runtimePromise = undefined
          throw error
        }
      }
      runtimePromise = create()
    }

    try {
      const runtime = await runtimePromise
      await runtime.startup
      return runtime
    } catch (error) {
      runtimePromise = undefined
      throw error
    }
  }

  const init = (): Promise<void> => {
    initPromise ??= (async () => {
      try {
        if (!wasmModule && !isInstanceFactory) {
          wasmModule = getWasm instanceof WebAssembly.Module ? getWasm : await loadModule()
        }
        await getRuntime()
        ready = true
      } catch (error) {
        initPromise = undefined
        throw error
      }
    })()
    return initPromise
  }

  /* istanbul ignore next -- @preserve */
  const invalidateRuntime = () => {
    runtimePromise = undefined
  }

  const withRuntime = async <T>(run: (runtime: GoRuntime) => T): Promise<T> => {
    let runtime = await getRuntime()
    /* istanbul ignore if -- @preserve */
    if (runtime.go.exited) {
      invalidateRuntime()
      runtime = await getRuntime()
    }
    try {
      return run(runtime)
    } catch (error) {
      /* istanbul ignore next -- @preserve */
      if (error instanceof WebAssembly.RuntimeError || error instanceof RangeError) {
        invalidateRuntime()
      }
      throw error
    }
  }

  const enqueue = async <T>(run: () => Promise<T>): Promise<T> => {
    const previous = queue
    let release!: () => void
    // eslint-disable-next-line unicorn/prefer-promise-with-resolvers -- Node 18 compatibility
    queue = new Promise<void>(resolve => {
      release = resolve
    })
    await previous
    try {
      return await run()
    } finally {
      release()
    }
  }

  const processor = (async (
    textOrAst: PrintableNode | string,
    options: InternalOptions = {},
  ): Promise<File | string> => {
    if (!ready) {
      await init()
    }
    return enqueue(() => withRuntime(current => invoke(current.exports, textOrAst, options)))
  }) as Processor
  processor.init = init
  processor.createInteractiveParser = (
    options: ShInteractiveOptions = {},
  ): AsyncInteractiveParser => {
    let pending = ''
    let incomplete = false
    return {
      get incomplete() {
        return incomplete
      },
      write: async (chunk: string) => {
        if (typeof chunk !== 'string') {
          throw new InputError('interactive chunks must be strings')
        }
        /* istanbul ignore if -- @preserve */
        if (!ready) {
          await init()
        }
        return enqueue(() =>
          withRuntime(current => {
            const result = invokeInteractive(current.exports, pending + chunk, options)
            pending = result.remaining
            incomplete = result.incomplete
            return { ast: result.ast, incomplete, remaining: result.remaining }
          }),
        )
      },
      reset() {
        pending = ''
        incomplete = false
      },
    }
  }
  processor.splitBraces = async (word: Word): Promise<SplitBracesResult> => {
    /* istanbul ignore if -- @preserve */
    if (!ready) {
      await init()
    }
    return enqueue(() => withRuntime(current => invokeSplitBraces(current.exports, word)))
  }
  return processor
}
