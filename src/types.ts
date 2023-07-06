export type ValueOf<T> = T[keyof T]

export const LangVariant = {
  LangBash: 0,
  LangPOSIX: 1,
  LangMirBSDKorn: 2,
  LangBats: 3,
} as const

export type LangVariant = ValueOf<typeof LangVariant>

export interface ShParserOptions {
  keepComments?: boolean
  stopAt?: string
  variant?: LangVariant
}

export interface ShPrinterOptions {
  indent?: number
  binaryNextLine?: boolean
  switchCaseIndent?: boolean
  spaceRedirects?: boolean
  keepPadding?: boolean
  minify?: boolean
  functionNextLine?: boolean
}

export interface ShSyntaxOptions extends ShParserOptions, ShPrinterOptions {}

export interface ShOptions extends ShSyntaxOptions {
  filepath?: string

  useTabs?: boolean
  tabWidth?: number
}

export interface ShPrintOptions extends ShOptions {
  originalText: string
}

export interface Pos {
  Col: number
  Line: number
  Offset: number
}

export interface Node {
  Pos: Pos
  End: Pos
}

export interface Comment extends Node {
  Text: string
}

export interface Word extends Node {
  Parts: Node[]
  Lit: string
}

export interface Lit extends Node {
  ValuePos: Pos
  ValueEnd: Pos
  Value: string
}

export interface Redirect extends Node {
  OpPos: Pos
  Op: string
  N: Lit | null
  Word: Word
  Hdoc: Word | null
}

export interface Stmt extends Node {
  Comments: Comment[]
  Cmd: Node | null
  Position: Pos
  Semicolon: Pos
  Negated: boolean
  Background: boolean
  Coprocess: boolean
  Redirs: Redirect[]
}

export interface File extends Node {
  Name: string
  Stmts: Stmt[]
}

export interface IParseError {
  Filename?: string
  Incomplete: boolean
  Text: string
  Pos?: Pos
}
