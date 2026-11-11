---
"sh-syntax": minor
---

Add `init()` to load the WASM runtime explicitly and cache it. The async `parse` and `print` APIs initialize automatically. The browser entry now uses the same `init()` plus async API without top-level await.
