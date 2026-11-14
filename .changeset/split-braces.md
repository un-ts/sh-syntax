---
"sh-syntax": patch
---

Add `splitBraces(word)` returning `{ word, changed }` to split brace expressions into `BraceExp` parts for analysis. `changed` is true when mvdan processed brace syntax, even if no `BraceExp` remains. The returned word keeps its original source span; synthetic split nodes have no source positions, and the printer cannot render `BraceExp`; such trees are rejected explicitly.
