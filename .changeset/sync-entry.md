---
"sh-syntax": patch
---

Move the synchronous API to the `sh-syntax/sync` entry (Node and browser top-level await variants; workerd has no sync variant and fails at build/import time) and keep the root entry async-only. The old `parseSync` / `printSync` names are now `parse` / `print` from `sh-syntax/sync`.
