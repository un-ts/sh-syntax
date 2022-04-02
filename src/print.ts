/* eslint-disable @typescript-eslint/restrict-plus-operands */
import { ShOptions } from './types.js'

let id = 0

export const getPrinter = (
  getWasmFile: () => BufferSource | Promise<BufferSource>,
) => {
  let wasmFile: BufferSource | undefined
  let wasmFilePromise: Promise<BufferSource> | undefined

  return async (
    text: string,
    {
      filepath,
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
    }: Partial<ShOptions> = {},
  ) => {
    if (!wasmFile) {
      if (!wasmFilePromise) {
        wasmFilePromise = Promise.resolve(getWasmFile())
      }
      wasmFile = await wasmFilePromise
    }

    const go = new Go()

    const uid = id++

    const argv = [
      'js',
      '-uid=' + uid,
      '-text=' + text,
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

    if (stopAt != null) {
      argv.push('-stopAt=' + stopAt)
    }

    if (variant != null) {
      argv.push('-variant=' + variant)
    }

    go.argv = argv

    const result = await WebAssembly.instantiate(wasmFile, go.importObject)

    const wasm = result.instance

    await go.run(wasm)

    const processed = Go.__shProcessing[uid]

    delete Go.__shProcessing[uid]

    if ('error' in processed) {
      throw new Error(processed.error)
    }

    return processed.text
  }
}
