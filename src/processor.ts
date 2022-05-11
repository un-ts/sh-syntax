import { IParseError, File, ShOptions, LangVariant } from './types.js'

export class ParseError extends Error implements IParseError {
  Filename: string
  Incomplete: boolean
  Text: string
  Pos: {
    Col: number
    Line: number
    Offset: number
  }

  constructor({ Filename, Incomplete, Text, Pos }: IParseError) {
    super(Text)
    this.Filename = Filename
    this.Incomplete = Incomplete
    this.Text = Text
    this.Pos = Pos
  }
}

export const getProcessor = async (
  getWasmFile: () => BufferSource | Promise<BufferSource>,
  // eslint-disable-next-line sonarjs/cognitive-complexity
) => {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  const go = new Go()

  const result = await WebAssembly.instantiate(
    await getWasmFile(),
    go.importObject,
  )

  const wasm = result.instance

  // Do not await this promise, because it only resolves once the go main()
  // function has exited. But we need the main function to stay alive to be
  // able to call the `parse` and `print` function.
  // eslint-disable-next-line no-void
  void go.run(wasm)

  const { memory, wasmAlloc, wasmFree, process } = wasm.exports as {
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

      isAst: boolean,

      keepComments: boolean,
      stopAtPointer: number,
      stopAt0: number,
      stopAt1: number,
      variant: LangVariant,

      indent: number,
      binaryNextLine: boolean,
      switchCaseIndent: boolean,
      spaceRedirects: boolean,
      keepPadding: boolean,
      minify: boolean,
      functionNextLine: boolean,
    ) => number
  }

  if (
    !(memory instanceof WebAssembly.Memory) ||
    !(wasmAlloc instanceof Function) ||
    !(wasmFree instanceof Function) ||
    !(process instanceof Function)
  ) {
    throw new TypeError(
      'Invalid wasm exports. Expected memory, wasmAlloc, wasmFree, process.',
    )
  }

  function processor(text: string, options?: ShOptions): File
  function processor(ast: File, options?: ShOptions): string

  function processor(
    textOrAst: File | string,
    {
      filepath,
      originalText,

      keepComments = true,
      stopAt = '',
      variant = LangVariant.LangBash,

      useTabs = false,
      tabWidth = 2,
      indent = useTabs ? 0 : tabWidth,
      binaryNextLine = true,
      switchCaseIndent = true,
      spaceRedirects = true,
      keepPadding = false,
      minify = false,
      functionNextLine = false,
    }: ShOptions = {},
  ) {
    let isAst = false

    if (typeof textOrAst !== 'string') {
      isAst = true

      if (originalText == null) {
        console.warn(
          '`originalText` is required for now, hope we will find better solution later',
        )
      }
    }

    const filePath = encoder.encode(filepath)
    const text = encoder.encode(isAst ? originalText : (textOrAst as string))
    const uStopAt = encoder.encode(stopAt)

    const filePathPointer = wasmAlloc(filePath.byteLength)
    new Uint8Array(memory.buffer).set(filePath, filePathPointer)

    const textPointer = wasmAlloc(text.byteLength)
    new Uint8Array(memory.buffer).set(text, textPointer)

    const stopAtPointer = wasmAlloc(uStopAt.byteLength)
    new Uint8Array(memory.buffer).set(uStopAt, stopAtPointer)

    const resultPointer = process(
      filePathPointer,
      filePath.byteLength,
      filePath.byteLength,

      textPointer,
      text.byteLength,
      text.byteLength,

      isAst,

      keepComments,
      stopAtPointer,
      uStopAt.byteLength,
      uStopAt.byteLength,
      variant,

      indent,
      binaryNextLine,
      switchCaseIndent,
      spaceRedirects,
      keepPadding,
      minify,
      functionNextLine,
    )

    wasmFree(filePathPointer)
    wasmFree(textPointer)
    wasmFree(stopAtPointer)

    const result = new Uint8Array(memory.buffer).subarray(resultPointer)
    const end = result.indexOf(0)

    const string = decoder.decode(result.subarray(0, end))

    const {
      file,
      text: processedText,
      parseError,
      message,
    } = JSON.parse(string) as {
      file: File
      text: string
      parseError: IParseError | null
      message: string
    }

    if (parseError || message) {
      /* istanbul ignore next */
      throw parseError == null
        ? new SyntaxError(message)
        : new ParseError(parseError)
    }

    return isAst ? processedText : file
  }

  return processor
}
