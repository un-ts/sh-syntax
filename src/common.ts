import type { IParseError, Pos } from './types.js'

export class ParseError extends Error implements IParseError {
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

export * from './ast.js'
export * from './source.js'
export * from './types.js'
