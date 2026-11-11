---
"sh-syntax": patch
---

Add enter/exit visitors to `walk`: a function is the `enter` phase, an object may pair optional `enter` with required `exit`, and visitors receive `(node, parent, prop, index)`. Returning `false` from `enter` skips a node's children; returning `false` from `exit` stops the walk.
