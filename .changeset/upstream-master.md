---
"sh-syntax": patch
---

Update `mvdan.cc/sh/v3` to a pinned commit containing the parser nesting limit, `BraceExp` walk support, and heredoc/Interactive fixes. AST heredoc redirects now expose `closePos`; local walk/recover workarounds are removed.
