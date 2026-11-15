---
"sh-syntax": patch
---

Update `mvdan.cc/sh/v3` to a pinned commit containing the parser nesting limit, `BraceExp` walk support, heredoc/Interactive fixes, and current AST fields. AST heredoc redirects now expose `closePos`, and split brace expansions retain their brace positions. Deeper JS/WASM transport handling, including the nesting limit's practical ceiling, remains tracked in #188.
