import type { IParseError, Pos } from './types.js'

/** Stable error codes for callers that should not depend on messages. */
export const ErrorCode = {
  Parse: 'SH_SYNTAX_PARSE',
  Language: 'SH_SYNTAX_LANGUAGE',
  Input: 'SH_SYNTAX_INPUT',
  Print: 'SH_SYNTAX_PRINT',
  SplitBraces: 'SH_SYNTAX_SPLIT_BRACES',
} as const

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode]

export abstract class ShSyntaxError extends SyntaxError {
  abstract readonly code: ErrorCode
  override name = 'ShSyntaxError'
}

export class ParseError extends ShSyntaxError implements IParseError {
  override readonly code = ErrorCode.Parse
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

export class LanguageError extends ShSyntaxError {
  override readonly code = ErrorCode.Language
  override name = 'LanguageError'
}

export class InputError extends TypeError {
  readonly code = ErrorCode.Input
  override name = 'InputError'
}

export class PrintError extends ShSyntaxError {
  override readonly code = ErrorCode.Print
  override name = 'PrintError'
}

export class SplitBracesError extends ShSyntaxError {
  override readonly code = ErrorCode.SplitBraces
  override name = 'SplitBracesError'
}

export * from './ast.js'
export * from './source.js'
export * from './types.js'
