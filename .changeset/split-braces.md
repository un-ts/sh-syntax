---
"sh-syntax": patch
---

Add `splitBraces(word)` to split brace expressions into `BraceExp` parts for analysis. The printer cannot render `BraceExp` and rejects such trees explicitly.
