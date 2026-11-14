import {
  InputError,
  LanguageError,
  ParseError,
  PrintError,
  SplitBracesError,
  type ShSyntaxError,
} from './common.js'
import {
  type File,
  type IParseError,
  LangVariant,
  type PrintableNode,
  type ShPrintOptions,
  type SplitBracesResult,
  type Word,
} from './types.js'
import { decodeAST, encodeAST } from './wire.js'

export interface InternalOptions extends ShPrintOptions {
  print?: boolean
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
  printNode: (nodePointer: number, nodeLength: number, optionsPointer: number) => number
  splitBraces: (nodePointer: number, nodeLength: number) => number
  resultLength: () => number
}

interface RawResult {
  text: string
  parseError: IParseError | null
  message: string
  changed?: boolean
}

const MAX_STOP_AT_BYTES = 4
const STOP_AT_OPTION_OFFSET = 16
const RESULT_HEADER_BYTES = 4

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

export interface GoRuntime {
  go: Go
  exports: ProcessExports
  run: Promise<void>
}

export const startGoRuntime = (go: Go, instance: WebAssembly.Instance): GoRuntime => {
  const exports = normalizeExports(instance.exports)

  if (
    !(exports.mem instanceof WebAssembly.Memory) ||
    typeof (exports as ProcessExports & { run?: unknown }).run !== 'function'
  ) {
    throw new TypeError('getProcessor requires a Go WASM instance')
  }

  const run = go.run(instance)
  if (go.exited) {
    // Attach a handler before throwing so an already-rejected run is not unhandled.
    void run.catch(() => undefined)
    throw new Error('Go runtime exited during startup')
  }
  return { go, exports, run }
}

interface DecodedResult {
  metadata: RawResult
  ast: Uint8Array
}

type MessageError = new (message: string) => ShSyntaxError

const readResult = (
  memory: WebAssembly.Memory,
  resultPointer: number,
  resultLength: number,
  ErrorType: MessageError,
): DecodedResult => {
  // eslint-disable-next-line unicorn/no-unsafe-buffer-conversion -- WASM linear memory
  const result = new Uint8Array(memory.buffer).subarray(resultPointer, resultPointer + resultLength)
  // eslint-disable-next-line unicorn/no-top-level-assignment-in-function -- lazy module cache
  decoder ??= new TextDecoder()
  const metadataLength = new DataView(
    result.buffer,
    result.byteOffset,
    RESULT_HEADER_BYTES,
  ).getUint32(0, true)
  const metadata = JSON.parse(
    decoder.decode(result.subarray(RESULT_HEADER_BYTES, RESULT_HEADER_BYTES + metadataLength)),
  ) as RawResult
  if (metadata.parseError) {
    throw new ParseError(metadata.parseError)
  }
  if (metadata.message) {
    throw new ErrorType(metadata.message)
  }
  return {
    metadata,
    ast: result.subarray(RESULT_HEADER_BYTES + metadataLength),
  }
}

export const invoke = (
  { memory, wasmAlloc, wasmFree, process, printNode, resultLength }: ProcessExports,
  textOrAst: PrintableNode | string,
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
    throw new InputError(`Unsupported shell variant: ${variant}`)
  }

  if (
    textOrAst == null ||
    (typeof textOrAst !== 'string' && (typeof textOrAst !== 'object' || Array.isArray(textOrAst)))
  ) {
    throw new InputError('expected shell source text or a syntax tree')
  }

  let text: string
  let printOutput: boolean
  let astBytes: Uint8Array | undefined

  if (typeof textOrAst === 'string') {
    text = textOrAst
    printOutput = print
  } else if (originalText == null) {
    astBytes = encodeAST(textOrAst)
    text = ''
    printOutput = true
  } else {
    text = originalText
    printOutput = true
  }

  const textBytes = encoder.encode(text)
  const stopAtBytes = encoder.encode(stopAt)
  if (stopAtBytes.byteLength > MAX_STOP_AT_BYTES) {
    throw new InputError('stopAt must be at most 4 bytes')
  }

  let filePathPointer = 0
  let filePathLength = 0
  if (!astBytes) {
    const filePath = encoder.encode(filepath)
    filePathLength = filePath.byteLength
    filePathPointer = wasmAlloc(filePathLength)
    // eslint-disable-next-line unicorn/no-unsafe-buffer-conversion -- WASM linear memory
    new Uint8Array(memory.buffer).set(filePath, filePathPointer)
  }

  const inputBytes = astBytes ?? textBytes
  const textPointer = wasmAlloc(inputBytes.byteLength)
  // eslint-disable-next-line unicorn/no-unsafe-buffer-conversion -- WASM linear memory
  new Uint8Array(memory.buffer).set(inputBytes, textPointer)

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

  const resultPointer = astBytes
    ? printNode(textPointer, astBytes.byteLength, optionsPointer)
    : process(filePathPointer, filePathLength, textPointer, textBytes.byteLength, optionsPointer)

  if (!astBytes) {
    wasmFree(filePathPointer)
  }
  wasmFree(textPointer)
  wasmFree(optionsPointer)

  const { metadata, ast } = readResult(
    memory,
    resultPointer,
    resultLength(),
    astBytes || printOutput ? PrintError : LanguageError,
  )
  return printOutput ? metadata.text : decodeAST(ast)
}

export const invokeSplitBraces = (
  { memory, wasmAlloc, wasmFree, splitBraces, resultLength }: ProcessExports,
  word: Word,
): SplitBracesResult => {
  const bytes = encodeAST(word)
  const start = word.start
  const end = word.end
  const nodePointer = wasmAlloc(bytes.byteLength)
  // eslint-disable-next-line unicorn/no-unsafe-buffer-conversion -- WASM linear memory
  new Uint8Array(memory.buffer).set(bytes, nodePointer)
  const resultPointer = splitBraces(nodePointer, bytes.byteLength)
  wasmFree(nodePointer)
  const { metadata, ast } = readResult(memory, resultPointer, resultLength(), SplitBracesError)
  const result = decodeAST(ast) as unknown as Word
  result.start = start
  result.end = end
  return { word: result, changed: metadata.changed === true }
}
