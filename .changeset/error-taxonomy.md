---
"sh-syntax": patch
---

Expose stable error classes and codes. `ParseError` now extends `ShSyntaxError`/`SyntaxError` and reports `name: "ParseError"`; `InputError` extends `TypeError`; other syntax failures use `ShSyntaxError` with one of `SH_SYNTAX_LANGUAGE`, `SH_SYNTAX_PRINT`, or `SH_SYNTAX_SPLIT_BRACES`.
