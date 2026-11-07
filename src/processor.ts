import {
  type IParseError,
  type File,
  type Pos,
  type ShOptions,
  LangVariant,
} from './types.js'

export class ParseError extends Error implements IParseError {
  Filename?: string
  Incomplete: boolean
  Text: string
  Pos?: Pos

  constructor({ Filename, Incomplete, Text, Pos }: IParseError) {
    super(Text)
    this.Filename = Filename
    this.Incomplete = Incomplete
    this.Text = Text
    this.Pos = Pos
  }
}

export type GetWebAssemblySource = () =>
  Buffer | BufferSource | Promise<Buffer | BufferSource | Response> | Response

export type GetWebAssemblyInstance = (
  imports: WebAssembly.Imports,
) => Promise<WebAssembly.Instance> | WebAssembly.Instance

type ProcessMode = 0 | 1 | 2

interface InternalOptions extends ShOptions {
  print?: boolean
  /** Only present so the public wrappers can reject the legacy combination. */
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

    mode: ProcessMode,

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

let encoder: TextEncoder | undefined
let decoder: TextDecoder | undefined

const stringifyAst = (textOrAst: File): string => {
  const ast = textOrAst as File & { __type?: string }

  /*
   * The root needs a Type for the Go decoder. Files have one; other roots,
   * such as a Stmt or Word, only carry __type.
   */
  if (ast.Type || !ast.__type) {
    return JSON.stringify(textOrAst)
  }

  const { __type, ...rest } = ast
  return JSON.stringify({ ...rest, Type: __type })
}

const invoke = (
  { memory, wasmAlloc, wasmFree, process }: ProcessExports,
  textOrAst: File | string,
  {
    filepath = '',
    print = false,
    originalText: legacyText,

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

  if ((textOrAst as File | string | null | undefined) == null) {
    throw new TypeError('Expected shell source text or a syntax tree')
  }

  if (typeof textOrAst !== 'string' && legacyText != null) {
    throw new TypeError(
      '`originalText` cannot be combined with an AST; pass the source text to print() instead',
    )
  }

  let mode: ProcessMode
  let text: string

  if (typeof textOrAst === 'string') {
    text = textOrAst
    mode = print ? 1 : 0
  } else {
    text = stringifyAst(textOrAst)
    mode = 2
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

    mode,

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
      Filename: filepath,
      Incomplete: true,
      Text: string,
    })
  }

  const {
    file,
    text: processedText,
    parseError,
    message,
  } = JSON.parse(string) as RawResult

  if (parseError || message) {
    throw parseError == null
      ? new SyntaxError(message)
      : new ParseError(parseError)
  }

  return mode === 0 ? file : processedText
}

/**
 * Creates a synchronous processor from WASM bytes that are already available.
 *
 * This is useful for Node.js and for callers that preload the WASM file. The
 * asynchronous [getProcessor] remains the recommended browser entry point.
 */
export const createSyncProcessor = (wasmBufferSource: BufferSource) => {
  const module = new WebAssembly.Module(wasmBufferSource)

  function processor(text: string, options?: ShOptions): File
  function processor(
    text: string,
    options?: ShOptions & { print: true },
  ): string
  function processor(ast: File, options?: ShOptions): string
  function processor(
    textOrAst: File | string,
    options?: InternalOptions,
  ): File | string {
    const go = new Go()
    const instance = new WebAssembly.Instance(module, go.importObject)
    /*
     * `go.run` only resolves when the Go program exits. The exported `process`
     * function is available synchronously after `_start` has run.
     */
    void go.run(instance)
    return invoke(instance.exports as ProcessExports, textOrAst, options)
  }

  return processor
}

export const getProcessor = (
  getWasm: GetWebAssemblyInstance | GetWebAssemblySource,
) => {
  let wasmBufferSource: Buffer | BufferSource | undefined
  let wasmBufferSourcePromise: Promise<Buffer | BufferSource> | undefined

  encoder ??= new TextEncoder()
  decoder ??= new TextDecoder()

  function processor(text: string, options?: ShOptions): Promise<File>
  function processor(
    text: string,
    options?: ShOptions & { print: true },
  ): Promise<string>
  function processor(ast: File, options?: ShOptions): Promise<string>
  async function processor(
    textOrAst: File | string,
    options: InternalOptions = {},
  ): Promise<File | string> {
    if (!wasmBufferSource && !wasmBufferSourcePromise && getWasm.length === 0) {
      wasmBufferSourcePromise = Promise.resolve(
        (getWasm as GetWebAssemblySource)(),
      ).then(
        /* istanbul ignore next */ source =>
          'arrayBuffer' in source ? source.arrayBuffer() : source,
      )
    }

    if (wasmBufferSourcePromise) {
      wasmBufferSource = await wasmBufferSourcePromise
    }

    const go = new Go()

    const wasm =
      getWasm.length === 0
        ? await WebAssembly.instantiate(
            wasmBufferSource as BufferSource,
            go.importObject,
          )
        : {
            instance: await (getWasm as GetWebAssemblyInstance)(
              go.importObject,
            ),
          }

    /**
     * Do not await this promise, because it only resolves once the Go main()
     * function has exited. But we need the main function to stay alive to be
     * able to call the `process` function.
     */
    void go.run(wasm.instance)

    return invoke(wasm.instance.exports as ProcessExports, textOrAst, options)
  }

  return processor
}
