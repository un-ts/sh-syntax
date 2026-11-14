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

export class ShSyntaxError extends SyntaxError {
  readonly code: ErrorCode
  override name = 'ShSyntaxError'

  constructor(code: ErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

export class ParseError extends ShSyntaxError implements IParseError {
  override name = 'ParseError'
  filename?: string
  incomplete: boolean
  text: string
  pos?: Pos

  constructor({ filename, incomplete, text, pos }: IParseError) {
    super(ErrorCode.Parse, text)
    this.filename = filename
    this.incomplete = incomplete
    this.text = text
    this.pos = pos
  }
}

export class InputError extends TypeError {
  readonly code = ErrorCode.Input
  override name = 'InputError'
}

export * from './ast.js'
export * from './source.js'
export * from './types.js'
