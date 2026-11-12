import { ParseError } from './common.js'
import { type File, type IParseError, LangVariant, type ShOptions } from './types.js'

export interface InternalOptions extends ShOptions {
  print?: boolean
  originalText?: string
}

export interface ProcessExports {
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
const STOP_AT_OPTION_OFFSET = 16

const supportedVariants = new Set<LangVariant>([
  LangVariant.LangBash,
  LangVariant.LangPOSIX,
  LangVariant.LangMirBSDKorn,
  LangVariant.LangBats,
  LangVariant.LangZsh,
])

let encoder: TextEncoder | undefined
let decoder: TextDecoder | undefined

export const normalizeExports = (exports: WebAssembly.Exports) => {
  const memory = (exports.memory ?? exports.mem) as WebAssembly.Memory
  return { ...exports, memory } as ProcessExports
}

export const invoke = (
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

  const optionValues = [
    printOutput,
    keepComments,
    variant,
    recoverErrors,
    0,
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
  ] as const
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
  new Uint8Array(memory.buffer, optionsPointer + STOP_AT_OPTION_OFFSET, MAX_STOP_AT_BYTES).set(
    stopAtBytes,
  )

  const resultPointer = process(
    filePathPointer,
    filePath.byteLength,
    textPointer,
    textBytes.byteLength,
    optionsPointer,
  )

  wasmFree(filePathPointer)
  wasmFree(textPointer)
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
