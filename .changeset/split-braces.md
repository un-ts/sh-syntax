---
"sh-syntax": patch
---

Add `splitBraces(word)` to split brace expressions into `BraceExp` parts for analysis. Synthetic split nodes have no source positions, and the printer cannot render `BraceExp`; such trees are rejected explicitly.
