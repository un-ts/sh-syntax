import { type IParseError, type File, type Pos, type ShOptions, LangVariant } from './types.js'

export class ParseError extends Error implements IParseError {
  filename?: string
  incomplete: boolean
  text: string
  pos?: Pos

  constructor({ filename, incomplete, text, pos }: IParseError) {
    super(text)
    this.filename = filename
    this.incomplete = incomplete
    this.text = text
    this.pos = pos
  }
}

export type WebAssemblyBaseSource = Buffer | BufferSource
export type WebAssemblySource =
  | WebAssemblyBaseSource
  | {
      headers?: { get(name: string): string | null }
      arrayBuffer(): Promise<ArrayBuffer>
    }

export type GetWebAssemblySource = () => Promise<WebAssemblySource> | WebAssemblySource

export type GetWebAssemblySourceSync = () => WebAssemblyBaseSource

export type GetWebAssemblyInstance = (
  imports: WebAssembly.Imports,
) => Promise<WebAssembly.Instance> | WebAssembly.Instance

interface InternalOptions extends ShOptions {
  print?: boolean
  originalText?: string
}

interface ProcessExports {
  memory: WebAssembly.Memory
  mem?: WebAssembly.Memory
  wasmAlloc: (size: number) => number
  wasmFree: (pointer: number) => void
  process: (
    filePathPointer: number,
    filePathLength: number,
    textPointer: number,
    textLength: number,
    optionsPointer: number,
  ) => number
}

interface RawResult {
  file: File
  text: string
  parseError: IParseError | null
  message: string
}

const MAX_STOP_AT_BYTES = 4

const supportedVariants = new Set<LangVariant>([
  LangVariant.LangBash,
  LangVariant.LangPOSIX,
  LangVariant.LangMirBSDKorn,
  LangVariant.LangBats,
  LangVariant.LangZsh,
])

let encoder: TextEncoder | undefined
let decoder: TextDecoder | undefined

const normalizeExports = (exports: WebAssembly.Exports): ProcessExports => {
  const memory = (exports.memory ?? exports.mem) as WebAssembly.Memory

  return { ...exports, memory } as ProcessExports
}

const invoke = (
  { memory, wasmAlloc, wasmFree, process }: ProcessExports,
  textOrAst: File | string,
  {
    filepath = '',
    print = false,
    originalText,

    keepComments = true,
    variant = LangVariant.LangBash,
    stopAt = '',
    recoverErrors = 0,

    useTabs = false,
    tabWidth = 2,
    simplify = false,
    indent = useTabs ? 0 : tabWidth,
    binaryNextLine = true,
    switchCaseIndent = true,
    spaceRedirects = true,
    keepPadding = false,
    minify = false,
    singleLine = false,
    functionNextLine = false,
  }: InternalOptions = {},
): File | string => {
  // eslint-disable-next-line unicorn/no-top-level-assignment-in-function -- lazy module cache
  encoder ??= new TextEncoder()
  // eslint-disable-next-line unicorn/no-top-level-assignment-in-function -- lazy module cache
  decoder ??= new TextDecoder()

  if (!supportedVariants.has(variant)) {
    throw new TypeError(`Unsupported shell variant: ${variant}`)
  }

  let text: string
  let printOutput: boolean

  if (typeof textOrAst === 'string') {
    text = textOrAst
    printOutput = print
  } else {
    if (originalText == null) {
      throw new TypeError(
        'processor(ast) is not supported; pass { originalText } to format the source text',
      )
    }
    text = originalText
    printOutput = true
  }

  const filePath = encoder.encode(filepath)
  const textBytes = encoder.encode(text)
  const stopAtBytes = encoder.encode(stopAt)
  if (stopAtBytes.byteLength > MAX_STOP_AT_BYTES) {
    throw new TypeError('stopAt must be at most 4 bytes')
  }

  const filePathPointer = wasmAlloc(filePath.byteLength)
  // eslint-disable-next-line unicorn/no-unsafe-buffer-conversion -- WASM linear memory
  new Uint8Array(memory.buffer).set(filePath, filePathPointer)

  const textPointer = wasmAlloc(textBytes.byteLength)
  // eslint-disable-next-line unicorn/no-unsafe-buffer-conversion -- WASM linear memory
  new Uint8Array(memory.buffer).set(textBytes, textPointer)

  const stopAtPointer = wasmAlloc(stopAtBytes.byteLength)
  // eslint-disable-next-line unicorn/no-unsafe-buffer-conversion -- WASM linear memory
  new Uint8Array(memory.buffer).set(stopAtBytes, stopAtPointer)

  const optionValues = [
    printOutput,
    keepComments,
    variant,
    recoverErrors,
    stopAtPointer,
    stopAtBytes.byteLength,
    simplify,
    indent,
    binaryNextLine,
    switchCaseIndent,
    spaceRedirects,
    keepPadding,
    minify,
    singleLine,
    functionNextLine,
  ]
  const optionsPointer = wasmAlloc(optionValues.length * Uint32Array.BYTES_PER_ELEMENT)
  const options = new DataView(
    memory.buffer,
    optionsPointer,
    optionValues.length * Uint32Array.BYTES_PER_ELEMENT,
  )
  let optionOffset = 0
  for (const value of optionValues) {
    options.setUint32(optionOffset, Number(value), true)
    optionOffset += Uint32Array.BYTES_PER_ELEMENT
  }

  const resultPointer = process(
    filePathPointer,
    filePath.byteLength,
    textPointer,
    textBytes.byteLength,
    optionsPointer,
  )

  wasmFree(filePathPointer)
  wasmFree(textPointer)
  wasmFree(stopAtPointer)
  wasmFree(optionsPointer)

  // eslint-disable-next-line unicorn/no-unsafe-buffer-conversion -- WASM linear memory
  const result = new Uint8Array(memory.buffer).subarray(resultPointer)
  const end = result.indexOf(0)
  const string = decoder.decode(result.subarray(0, end))

  // Naive check that the WASM module returned JSON.
  /* istanbul ignore if -- @preserve */
  if (!string.startsWith('{"') || !string.endsWith('}')) {
    throw new ParseError({
      filename: filepath,
      incomplete: true,
      text: string,
    })
  }

  const { file, text: processedText, parseError, message } = JSON.parse(string) as RawResult

  if (parseError) {
    throw new ParseError(parseError)
  }

  if (message) {
    throw new SyntaxError(message)
  }

  return printOutput ? processedText : file
}

/**
 * Creates a synchronous processor from WASM bytes or a synchronous loader.
 *
 * The Go runtime is created once and reused. Standard Go WASM uses the normal Go GC, so the
 * instance can serve repeated synchronous calls.
 */
export const getProcessorSync = (getWasm: GetWebAssemblySourceSync | WebAssemblyBaseSource) => {
  const module = new WebAssembly.Module(typeof getWasm === 'function' ? getWasm() : getWasm)
  const createRuntime = () => {
    const go = new Go()
    const instance = new WebAssembly.Instance(module, go.importObject)
    // Do not await: main blocks in select{}; this resolves only when the Go program exits.
    void go.run(instance)
    return { go, exports: normalizeExports(instance.exports) }
  }
  let runtime = createRuntime()

  function processor(text: string, options?: ShOptions): File
  function processor(text: string, options?: ShOptions & { print: true }): string
  function processor(ast: File, options: ShOptions & { originalText: string }): string
  function processor(textOrAst: File | string, options?: InternalOptions): File | string {
    /* istanbul ignore if -- @preserve */
    if (runtime.go.exited) {
      runtime = createRuntime()
    }
    return invoke(runtime.exports, textOrAst, options)
  }

  return processor
}

export const getProcessor = (getWasm: GetWebAssemblyInstance | GetWebAssemblySource) => {
  let wasmModule: WebAssembly.Module | undefined
  let wasmModulePromise: Promise<WebAssembly.Module> | undefined
  let runtimePromise: Promise<{ go: Go; exports: ProcessExports }> | undefined
  let queue: Promise<unknown> = Promise.resolve()

  const loadModule = async (): Promise<WebAssembly.Module> => {
    const source = await (getWasm as GetWebAssemblySource)()

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
    const go = new Go()
    const instance =
      getWasm.length === 0
        ? await WebAssembly.instantiate(wasmModule as WebAssembly.Module, go.importObject)
        : await (getWasm as GetWebAssemblyInstance)(go.importObject)
    // Do not await: main blocks in select{}; this resolves only when the Go program exits.
    void go.run(instance)
    return { go, exports: normalizeExports(instance.exports) }
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
    return runtimePromise
  }

  /* istanbul ignore next -- @preserve */
  const invalidateRuntime = () => {
    runtimePromise = undefined
  }

  function processor(text: string, options?: ShOptions): Promise<File>
  function processor(text: string, options?: ShOptions & { print: true }): Promise<string>
  function processor(ast: File, options: ShOptions & { originalText: string }): Promise<string>
  async function processor(
    textOrAst: File | string,
    options: InternalOptions = {},
  ): Promise<File | string> {
    if (!wasmModule && !wasmModulePromise && getWasm.length === 0) {
      wasmModulePromise = loadModule()
    }

    if (wasmModulePromise) {
      try {
        wasmModule = await wasmModulePromise
      } finally {
        wasmModulePromise = undefined
      }
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
  }

  return processor
}
