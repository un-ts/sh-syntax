---
"sh-syntax": minor
---

Add `unist-util-visit`-style visitors to `walk`: a function is the `enter` phase, an object may pair optional `enter` with required `exit`, and visitors receive `(node, index, parent)`. Returning `false` stops the walk; returning `'skip'` skips a node's children.
