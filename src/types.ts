export enum LangVariant {
  LangBash = 0,
  LangPOSIX = 1,
  LangMirBSDKorn = 2,
  LangBats = 3,
}

export interface ShOptions {
  filepath?: string
  originalText?: string

  useTabs?: boolean
  tabWidth?: number

  // parser
  keepComments?: boolean
  stopAt?: string
  variant?: LangVariant

  // printer
  indent?: number
  binaryNextLine?: boolean
  switchCaseIndent?: boolean
  spaceRedirects?: boolean
  keepPadding?: boolean
  minify?: boolean
  functionNextLine?: boolean
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
  Filename: string
  Incomplete: boolean
  Text: string
  Pos: Pos
}

export interface ShProcessing {
  Text: string | null
  Data: File | string | null
  Error: IParseError | string | null
}
