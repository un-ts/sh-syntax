---
"sh-syntax": patch
---

Add `splitBraces(word)` returning `{ word, changed }` to split brace expressions into `BraceExp` parts for analysis. `changed` is true when mvdan processed brace syntax, even if no `BraceExp` remains. The returned word keeps its original source span. Split literals lack source positions, while composite `BraceExp` bounds may be derived from retained children and serialized. The printer cannot render `BraceExp`; such trees are rejected explicitly.
