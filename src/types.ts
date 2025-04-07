export type ValueOf<T> = T[keyof T]

export const LangVariant = {
  /**
   * LangBash corresponds to the GNU Bash language, as described in its
   * manual at https://www.gnu.org/software/bash/manual/bash.html.
   *
   * We currently follow Bash version 5.2.
   *
   * Its string representation is "bash".
   */
  LangBash: 0,
  /**
   * LangPOSIX corresponds to the POSIX Shell language, as described at
   * https://pubs.opengroup.org/onlinepubs/9699919799/utilities/V3_chap02.html.
   *
   * Its string representation is "posix" or "sh".
   */
  LangPOSIX: 1,
  /**
   * LangMirBSDKorn corresponds to the MirBSD Korn Shell, also known as
   * mksh, as described at http://www.mirbsd.org/htman/i386/man1/mksh.htm.
   * Note that it shares some features with Bash, due to the shared
   * ancestry that is ksh.
   *
   * We currently follow mksh version 59.
   *
   * Its string representation is "mksh".
   */
  LangMirBSDKorn: 2,
  /**
   * LangBats corresponds to the Bash Automated Testing System language,
   * as described at https://github.com/bats-core/bats-core. Note that
   * it's just a small extension of the Bash language.
   *
   * Its string representation is "bats".
   */
  LangBats: 3,
  /**
   * LangAuto corresponds to automatic language detection,
   * commonly used by end-user applications like shfmt,
   * which can guess a file's language variant given its filename or shebang.
   *
   * At this time, [Variant] does not support LangAuto.
   */
  LangAuto: 4,
} as const

export type LangVariant = ValueOf<typeof LangVariant>

export interface ShParserOptions {
  /**
   * KeepComments makes the parser parse comments and attach them to
   * nodes, as opposed to discarding them.
   */
  keepComments?: boolean
  /**
   * LangVariant describes a shell language variant to use when tokenizing and
   * parsing shell code. The zero value is [LangBash].
   */
  variant?: LangVariant
  /**
   * StopAt configures the lexer to stop at an arbitrary word, treating it
   * as if it were the end of the input. It can contain any characters
   * except whitespace, and cannot be over four bytes in size.
   *
   * This can be useful to embed shell code within another language, as
   * one can use a special word to mark the delimiters between the two.
   *
   * As a word, it will only apply when following whitespace or a
   * separating token. For example, StopAt("$$") will act on the inputs
   * "foo $$" and "foo;$$", but not on "foo '$$'".
   *
   * The match is done by prefix, so the example above will also act on
   * "foo $$bar".
   */
  stopAt?: string
  /**
   *  RecoverErrors allows the parser to skip up to a maximum number of
   *  errors in the given input on a best-effort basis.
   *  This can be useful to tab-complete an interactive shell prompt,
   *  or when providing diagnostics on slightly incomplete shell source.
   *
   *  Currently, this only helps with mandatory tokens from the shell grammar
   *  which are not present in the input. They result in position fields
   *  or nodes whose position report [Pos.IsRecovered] as true.
   *
   *  For example, given the input
   *
   * 	(foo |
   *
   *  the result will contain two recovered positions; first, the pipe requires
   *  a statement to follow, and as [Stmt.Pos] reports, the entire node is recovered.
   *  Second, the subshell needs to be closed, so [Subshell.Rparen] is recovered.
   */
  recoverErrors?: number
}

export interface ShPrinterOptions {
  /**
   * Indent sets the number of spaces used for indentation. If set to 0,
   * tabs will be used instead.
   */
  indent?: number
  /**
   * BinaryNextLine will make binary operators appear on the next line
   * when a binary command, such as a pipe, spans multiple lines. A
   * backslash will be used.
   */
  binaryNextLine?: boolean
  /**
   * SwitchCaseIndent will make switch cases be indented. As such, switch
   * case bodies will be two levels deeper than the switch itself.
   */
  switchCaseIndent?: boolean
  /**
   * SpaceRedirects will put a space after most redirection operators. The
   * exceptions are '>&', '<&', '>(', and '<('.
   */
  spaceRedirects?: boolean
  /**
   * KeepPadding will keep most nodes and tokens in the same column that
   * they were in the original source. This allows the user to decide how
   * to align and pad their code with spaces.
   *
   * Note that this feature is best-effort and will only keep the
   * alignment stable, so it may need some human help the first time it is
   * run.
   *
   * @deprecated: this formatting option is flawed and buggy, and often does
   * not result in what the user wants when the code gets complex enough.
   *
   * The next major version, v4, will remove this feature entirely.
   * See: https://github.com/mvdan/sh/issues/658
   */
  keepPadding?: boolean
  /**
   * Minify will print programs in a way to save the most bytes possible.
   * For example, indentation and comments are skipped, and extra
   * whitespace is avoided when possible.
   */
  minify?: boolean
  /**
   * SingleLine will attempt to print programs in one line. For example, lists of
   * commands or nested blocks do not use newlines in this mode. Note that some
   * newlines must still appear, such as those following comments or around
   * here-documents.
   *
   * Print's trailing newline when given a [*File] is not affected by this option.
   */
  singleLine?: boolean
  // FunctionNextLine will place a function's opening braces on the next line.
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
