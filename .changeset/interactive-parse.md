---
"sh-syntax": patch
---

Add `createInteractiveParser()` for REPL-style chunked parsing. Each `write(chunk)` returns the statements completed by that chunk, the unconsumed trailing text, and whether it is incomplete.
