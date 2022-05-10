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

let uid = -1

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

    uid++

    if (uid === Number.MAX_SAFE_INTEGER) {
      uid = 0
    }

    Object.assign(go.importObject.env, {
      'main.getUid': () => uid,
    })

    const result = await WebAssembly.instantiate(wasmFile, go.importObject)

    const wasm = result.instance

    if (!Go.__shProcessing) {
      Go.__shProcessing = {}
    }

    Go.__shProcessing[uid] = {
      filepath,
      ast: isAst ? 'ast' : '',
      text: isAst ? originalText : (textOrAst as string),

      keepComments,
      stopAt,
      variant,

      indent,
      binaryNextLine,
      switchCaseIndent,
      spaceRedirects,
      keepPadding,
      minify,
      functionNextLine,
    }

    // eslint-disable-next-line no-void
    void go.run(wasm)

    const processed = Go.__shProcessing[uid]

    delete Go.__shProcessing[uid]

    const { data, error } = processed

    if (error) {
      /* istanbul ignore next */
      throw typeof error === 'string'
        ? new SyntaxError(error)
        : new ParseError(error)
    }

    return data
  }

  return processor
}
