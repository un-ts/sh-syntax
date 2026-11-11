---
"sh-syntax": minor
---

Add `unist-util-visit`-style visitors to `walk`: a function is the `enter` phase, an object may pair optional `enter` with required `exit`, and visitors receive `(node, index, parent)`. Returning `false` from `enter` skips a node's children; returning `false` from `exit` stops the walk.
