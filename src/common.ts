import type { IParseError, Pos } from './types.js'

/** Stable error codes for callers that should not depend on messages. */
export const ErrorCode = {
  parse: 'SH_SYNTAX_PARSE',
  input: 'SH_SYNTAX_INPUT',
  language: 'SH_SYNTAX_LANGUAGE',
  print: 'SH_SYNTAX_PRINT',
  splitBraces: 'SH_SYNTAX_SPLIT_BRACES',
} as const

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode]

export class ParseError extends Error implements IParseError {
  readonly code = ErrorCode.parse
  override name = 'ParseError'
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

export abstract class ShSyntaxError extends SyntaxError {
  abstract readonly code: ErrorCode
  override name = 'ShSyntaxError'
}

export class LanguageError extends ShSyntaxError {
  override readonly code = ErrorCode.language
  override name = 'LanguageError'
}

export class PrintError extends ShSyntaxError {
  override readonly code = ErrorCode.print
  override name = 'PrintError'
}

export class SplitBracesError extends ShSyntaxError {
  override readonly code = ErrorCode.splitBraces
  override name = 'SplitBracesError'
}

export class InputError extends TypeError {
  readonly code = ErrorCode.input
  override name = 'InputError'
}

export * from './ast.js'
export * from './source.js'
export * from './types.js'
