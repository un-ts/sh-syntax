export enum LangVariant {
  LangBash = 0,
  LangPOSIX = 1,
  LangMirBSDKorn = 2,
  LangBats = 3,
}

export interface ShOptions {
  filepath: string

  useTabs: boolean
  tabWidth: number

  // parser
  keepComments: boolean
  stopAt: string
  variant: LangVariant

  // printer
  indent: number
  binaryNextLine: boolean
  switchCaseIndent: boolean
  spaceRedirects: boolean
  keepPadding: boolean
  minify: boolean
  functionNextLine: boolean
}
