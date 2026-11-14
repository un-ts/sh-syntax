---
"sh-syntax": patch
---

Add `createInteractiveParser()` for REPL-style chunked parsing. Each `write(chunk)` returns the complete statements parsed so far and whether the remaining input is incomplete.
