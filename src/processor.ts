import {
  invoke,
  invokeSplitBraces,
  startGoRuntime,
  type GoRuntime,
  type InternalOptions,
} from './internal.js'
import {
  type File,
  type PrintableNode,
  type ShOptions,
  type ShPrintOptions,
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
  splitBraces: (word: Word) => Promise<Word>
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

  const processor = (async (
    textOrAst: PrintableNode | string,
    options: InternalOptions = {},
  ): Promise<File | string> => {
    if (!ready) {
      await init()
    }

    const previous = queue
    let release!: () => void
    // eslint-disable-next-line unicorn/prefer-promise-with-resolvers -- Node 18 compatibility
    queue = new Promise<void>(resolve => {
      release = resolve
    })
    await previous

    try {
      let runtime = await getRuntime()
      /* istanbul ignore if -- @preserve */
      if (runtime.go.exited) {
        invalidateRuntime()
        runtime = await getRuntime()
      }

      try {
        return invoke(runtime.exports, textOrAst, options)
      } catch (error) {
        /* istanbul ignore next -- @preserve */
        if (error instanceof WebAssembly.RuntimeError || error instanceof RangeError) {
          invalidateRuntime()
        }
        throw error
      }
    } finally {
      release()
    }
  }) as Processor
  processor.init = init
  processor.splitBraces = async (word: Word): Promise<Word> => {
    /* istanbul ignore if -- @preserve */
    if (!ready) {
      await init()
    }
    const previous = queue
    let release!: () => void
    // eslint-disable-next-line unicorn/prefer-promise-with-resolvers -- Node 18 compatibility
    queue = new Promise<void>(resolve => {
      release = resolve
    })
    await previous
    try {
      let runtime = await getRuntime()
      /* istanbul ignore if -- @preserve */
      if (runtime.go.exited) {
        invalidateRuntime()
        runtime = await getRuntime()
      }
      try {
        return invokeSplitBraces(runtime.exports, word)
      } catch (error) {
        /* istanbul ignore next -- @preserve */
        if (error instanceof WebAssembly.RuntimeError || error instanceof RangeError) {
          invalidateRuntime()
        }
        throw error
      }
    } finally {
      release()
    }
  }
  return processor
}
