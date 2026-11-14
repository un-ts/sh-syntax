---
"sh-syntax": patch
---

Expose stable error classes and codes. `ParseError` now extends `ShSyntaxError`/`SyntaxError` and reports `name: "ParseError"`. Codes: `ParseError` (`SH_SYNTAX_PARSE`), `LanguageError` (`SH_SYNTAX_LANGUAGE`), `InputError` (`SH_SYNTAX_INPUT`), `PrintError` (`SH_SYNTAX_PRINT`), and `SplitBracesError` (`SH_SYNTAX_SPLIT_BRACES`).
