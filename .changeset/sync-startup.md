---
"sh-syntax": patch
---

Surface Go startup failures from both async `init()` and the synchronous `sh-syntax/sync` processor instead of leaking an unhandled rejection.
