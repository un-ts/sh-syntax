import {
  type IParseError,
  type File,
  type ShOptions,
  LangVariant,
} from './types.js'

export class ParseError extends Error implements IParseError {
  Filename?: string
  Incomplete: boolean
  Text: string
  Pos?: {
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

export const getProcessor = (
  getWasmFile: () => BufferSource | Promise<BufferSource>,
) => {
  let wasmFile: BufferSource | undefined
  let wasmFilePromise: Promise<BufferSource> | undefined

  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  function processor(text: string, options?: ShOptions): Promise<File>
  function processor(
    text: string,
    options?: ShOptions & { print: true },
  ): Promise<string>
  function processor(
    ast: File,
    options?: ShOptions & {
      originalText: string
    },
  ): Promise<string>

  /**
   * Processes a shell script input using a WebAssembly module.
   *
   * This asynchronous function accepts shell script input either as a string or as an AST File, along with a set of options
   * that control formatting, error recovery, and output. It ensures that the WebAssembly module is loaded and instantiated,
   * allocates memory for the file path and text content, and then calls the module's processing function with the provided options.
   * Depending on the `print` flag, it returns either the processed text or a File representing the parsed AST.
   *
   * @param textOrAst - The shell script input as a string or as an AST File. When providing a non-string input and `print` is false,
   *                    the `originalText` option must be supplied.
   * @param options - An object containing processing options:
   *   - filepath: The file path associated with the input, used primarily for error reporting.
   *   - print: If true, the function returns the processed text; otherwise, it returns the processed AST as a File.
   *   - originalText: The original text of the shell script, required when `textOrAst` is not a string.
   *   - keepComments: Determines whether comments should be preserved in the output.
   *   - variant: Specifies the shell scripting variant (e.g., {@link LangVariant.LangBash}).
   *   - stopAt: A token indicating where to halt further processing.
   *   - recoverErrors: Sets the level of error recovery during processing (default is 0).
   *   - useTabs, tabWidth, indent: Options to control indentation formatting.
   *   - binaryNextLine, switchCaseIndent, spaceRedirects, keepPadding, minify, singleLine, functionNextLine:
   *     Additional flags that influence formatting details and output structure.
   *
   * @returns A promise that resolves to either the processed text (if `print` is true) or a File (if `print` is false).
   *
   * @throws {TypeError} If the original text is required but not provided.
   * @throws {ParseError} If the processed output is not valid JSON or indicates a parsing error.
   * @throws {SyntaxError} If a syntax error is detected without an associated parse error object.
   */
  async function processor(
    textOrAst: File | string,
    {
      filepath,
      print = false,
      originalText,

      keepComments = true,
      variant = LangVariant.LangBash,
      stopAt = '',
      recoverErrors = 0,

      useTabs = false,
      tabWidth = 2,
      indent = useTabs ? 0 : tabWidth,
      binaryNextLine = true,
      switchCaseIndent = true,
      spaceRedirects = true,
      keepPadding = false,
      minify = false,
      singleLine = false,
      functionNextLine = false,
    }: ShOptions & { print?: boolean; originalText?: string } = {},
  ) {
    if (!wasmFile) {
      if (!wasmFilePromise) {
        wasmFilePromise = Promise.resolve(getWasmFile())
      }
      wasmFile = await wasmFilePromise
    }

    if (typeof textOrAst !== 'string' && !print) {
      print = true

      if (originalText == null) {
        throw new TypeError(
          '`originalText` is required for now, hope we will find better solution later',
        )
      }
    }

    const go = new Go()

    const wasm = await WebAssembly.instantiate(wasmFile, go.importObject)

    // Do not await this promise, because it only resolves once the go main()
    // function has exited. But we need the main function to stay alive to be
    // able to call the `parse` and `print` function.

    void go.run(wasm.instance)

    const { memory, wasmAlloc, wasmFree, process } = wasm.instance.exports as {
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
        variant: LangVariant,
        stopAtPointer: number,
        stopAt0: number,
        stopAt1: number,
        recoverErrors: number,

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

    const filePath = encoder.encode(filepath)
    const text = encoder.encode(originalText || (textOrAst as string))
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

      print,

      keepComments,
      variant,
      stopAtPointer,
      uStopAt.byteLength,
      uStopAt.byteLength,
      recoverErrors,

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

    // naive check whether the string is a json
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
    } = JSON.parse(string) as {
      file: File
      text: string
      parseError: IParseError | null
      message: string
    }

    if (parseError || message) {
      throw parseError == null
        ? new SyntaxError(message)
        : new ParseError(parseError)
    }

    return print ? processedText : file
  }

  return processor
}
