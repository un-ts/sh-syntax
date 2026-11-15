---
"sh-syntax": patch
---

Update `mvdan.cc/sh/v3` to a pinned commit containing `BraceExp` walk support, heredoc/Interactive fixes, and current AST fields. AST heredoc redirects now expose `closePos`. The upstream parser nesting limit is present, but JS wire/printer recursion remains the practical ceiling; clean depth handling stays tracked separately.
