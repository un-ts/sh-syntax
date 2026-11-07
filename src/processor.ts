import {
  type IParseError,
  type File,
  type Pos,
  type ShOptions,
  LangVariant,
} from './types.js'

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

export type GetWebAssemblySource = () =>
  Promise<WebAssemblySource> | WebAssemblySource

export type GetWebAssemblySourceSync = () => WebAssemblyBaseSource

export type GetWebAssemblyInstance = (
  imports: WebAssembly.Imports,
) => Promise<WebAssembly.Instance> | WebAssembly.Instance

interface InternalOptions extends ShOptions {
  print?: boolean
  originalText?: string
}

interface ProcessExports extends WebAssembly.Exports {
  memory: WebAssembly.Memory
  wasmAlloc: (size: number) => number
  wasmFree: (pointer: number) => void
  process: (
    filePathPointer: number,
    filePath0: number,
    filePath1: number,

    textPointer: number,
    text0: number,
    text1: number,

    print: boolean,

    keepComments: boolean,
    variant: LangVariant,
    stopAtPointer: number,
    stopAt0: number,
    stopAt1: number,
    recoverErrors: number,

    simplify: boolean,
    indent: number,
    binaryNextLine: boolean,
    switchCaseIndent: boolean,
    spaceRedirects: boolean,
    keepPadding: boolean,
    minify: boolean,
    singleLine: boolean,
    functionNextLine: boolean,
  ) => number
}

interface RawResult {
  file: File
  text: string
  parseError: IParseError | null
  message: string
}

const supportedVariants = new Set<LangVariant>([
  LangVariant.LangBash,
  LangVariant.LangPOSIX,
  LangVariant.LangMirBSDKorn,
  LangVariant.LangBats,
  LangVariant.LangZsh,
])

let encoder: TextEncoder | undefined
let decoder: TextDecoder | undefined

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
    // eslint-disable-next-line sonarjs/deprecation -- still supported by mvdan/sh
    keepPadding = false,
    minify = false,
    singleLine = false,
    functionNextLine = false,
  }: InternalOptions = {},
): File | string => {
  encoder ??= new TextEncoder()
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

  const filePathPointer = wasmAlloc(filePath.byteLength)
  new Uint8Array(memory.buffer).set(filePath, filePathPointer)

  const textPointer = wasmAlloc(textBytes.byteLength)
  new Uint8Array(memory.buffer).set(textBytes, textPointer)

  const stopAtPointer = wasmAlloc(stopAtBytes.byteLength)
  new Uint8Array(memory.buffer).set(stopAtBytes, stopAtPointer)

  const resultPointer = process(
    filePathPointer,
    filePath.byteLength,
    filePath.byteLength,

    textPointer,
    textBytes.byteLength,
    textBytes.byteLength,

    printOutput,

    keepComments,
    variant,
    stopAtPointer,
    stopAtBytes.byteLength,
    stopAtBytes.byteLength,
    recoverErrors,

    simplify,
    indent,
    binaryNextLine,
    switchCaseIndent,
    spaceRedirects,
    keepPadding,
    minify,
    singleLine,
    functionNextLine,
  )

  wasmFree(filePathPointer)
  wasmFree(textPointer)
  wasmFree(stopAtPointer)

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

  const {
    file,
    text: processedText,
    parseError,
    message,
  } = JSON.parse(string) as RawResult

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
 * This is intended for bounded, one-off work. TinyGo's leaking GC means a
 * long-running synchronous loop will accumulate memory; use [getProcessor]
 * for long-lived processes.
 */
export const getProcessorSync = (
  getWasm: GetWebAssemblySourceSync | WebAssemblyBaseSource,
) => {
  const module = new WebAssembly.Module(
    typeof getWasm === 'function' ? getWasm() : getWasm,
  )
  function processor(text: string, options?: ShOptions): File
  function processor(
    text: string,
    options?: ShOptions & { print: true },
  ): string
  function processor(
    ast: File,
    options: ShOptions & { originalText: string },
  ): string
  function processor(
    textOrAst: File | string,
    options?: InternalOptions,
  ): File | string {
    const go = new Go()
    const instance = new WebAssembly.Instance(module, go.importObject)
    void go.run(instance)
    return invoke(instance.exports as ProcessExports, textOrAst, options)
  }

  return processor
}

export const getProcessor = (
  getWasm: GetWebAssemblyInstance | GetWebAssemblySource,
) => {
  let wasmModule: WebAssembly.Module | undefined
  let wasmModulePromise: Promise<WebAssembly.Module> | undefined

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
        source.headers
          .get('content-type')
          ?.split(';')[0]
          .trim()
          .toLowerCase() === 'application/wasm'
      ) {
        return WebAssembly.compileStreaming(source)
      }

      return WebAssembly.compile(await source.arrayBuffer())
    }

    return WebAssembly.compile(source)
  }

  function processor(text: string, options?: ShOptions): Promise<File>
  function processor(
    text: string,
    options?: ShOptions & { print: true },
  ): Promise<string>
  function processor(
    ast: File,
    options: ShOptions & { originalText: string },
  ): Promise<string>
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

    const go = new Go()

    const instance =
      getWasm.length === 0
        ? await WebAssembly.instantiate(
            wasmModule as WebAssembly.Module,
            go.importObject,
          )
        : await (getWasm as GetWebAssemblyInstance)(go.importObject)

    /**
     * Do not await this promise, because it only resolves once the Go main()
     * function has exited. But we need the main function to stay alive to be
     * able to call the `process` function.
     */
    void go.run(instance)

    return invoke(instance.exports as ProcessExports, textOrAst, options)
  }

  return processor
}
