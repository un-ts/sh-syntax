import {
  IParseError,
  File,
  ShOptions,
  Parse,
  Print,
  LangVariant,
} from './types.js'

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

export const getProcessor = (
  getWasmFile: () => BufferSource | Promise<BufferSource>,
) => {
  let wasmFile: BufferSource | undefined
  let wasmFilePromise: Promise<BufferSource> | undefined

  function processor(text: string, options?: ShOptions): Promise<File>
  function processor(ast: File, options?: ShOptions): Promise<string>

  async function processor(
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
    if (!wasmFile) {
      if (!wasmFilePromise) {
        wasmFilePromise = Promise.resolve(getWasmFile())
      }
      wasmFile = await wasmFilePromise
    }

    let isAst = false

    if (typeof textOrAst !== 'string') {
      isAst = true

      if (originalText == null) {
        console.warn(
          '`originalText` is required for now, hope we will find better solution later',
        )
      }
    }

    const go = new Go()

    const result = await WebAssembly.instantiate(wasmFile, go.importObject)

    const wasm = result.instance

    // eslint-disable-next-line no-void
    void go.run(wasm)

    const { parse, print } = wasm.exports as {
      parse: Parse
      print: Print
    }

    const parserOptions = [keepComments, stopAt, variant] as const

    const processed = isAst
      ? print(
          originalText!,
          filepath!,
          ...([
            ...parserOptions,
            indent,
            binaryNextLine,
            switchCaseIndent,
            spaceRedirects,
            keepPadding,
            minify,
            functionNextLine,
          ] as const),
        )
      : parse(textOrAst as string, filepath!, ...parserOptions)

    console.log('processed:', typeof processed)

    const { Data, Error } = processed

    if (Error) {
      /* istanbul ignore next */
      throw typeof Error === 'string'
        ? new SyntaxError(Error)
        : new ParseError(Error)
    }

    return Data
  }

  return processor
}
