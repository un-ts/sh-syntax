/* eslint-disable @typescript-eslint/restrict-plus-operands */
import { nanoid } from 'nanoid/async'

import type { IParseError, File, ShOptions } from './types.js'

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
  // eslint-disable-next-line sonarjs/cognitive-complexity
  async function processor(
    textOrAst: File | string,
    {
      filepath,
      originalText,

      keepComments = true,
      stopAt,
      variant,

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

    const go = new Go()

    const uid = await nanoid()

    let isAst = false

    if (typeof textOrAst !== 'string') {
      isAst = true

      if (originalText == null) {
        console.warn(
          '`originalText` is required for now, hope we will find better solution later',
        )
      }
    }

    if ('argv' in go) {
      const argv = [
        'js',
        '-uid=' + uid,
        '-keepComments=' + keepComments,
        '-indent=' + indent,
        '-binaryNextLine=' + binaryNextLine,
        '-switchCaseIndent=' + switchCaseIndent,
        '-spaceRedirects=' + spaceRedirects,
        '-keepPadding=' + keepPadding,
        '-minify=' + minify,
        '-functionNextLine=' + functionNextLine,
      ]

      if (filepath != null) {
        argv.push('-filepath=' + filepath)
      }

      if (isAst) {
        argv.push('-ast=ast')
      }

      if (stopAt != null) {
        argv.push('-stopAt=' + stopAt)
      }

      if (variant != null) {
        argv.push('-variant=' + variant)
      }

      go.argv = argv
    }

    const result = await WebAssembly.instantiate(wasmFile, go.importObject)

    const wasm = result.instance

    if (!Go.__shProcessing) {
      Go.__shProcessing = {}
    }

    Go.__shProcessing[uid] = {
      Text: isAst ? originalText! : (textOrAst as string),
      Data: null,
      Error: null,
    }

    await go.run(wasm)

    const processed = Go.__shProcessing[uid]

    delete Go.__shProcessing[uid]

    if ('Error' in processed && processed.Error != null) {
      /* istanbul ignore next */
      throw typeof processed.Error === 'string'
        ? new SyntaxError(processed.Error)
        : new ParseError(processed.Error)
    }

    return processed.Data
  }

  return processor
}
