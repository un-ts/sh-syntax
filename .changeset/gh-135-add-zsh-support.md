---
"sh-syntax": minor
---

Add zsh dialect support by rebuilding the WASM against a newer `mvdan/sh`:

- Rebuild `main.wasm` against `mvdan/sh` v3.13.1 (was v3.11.0) and expose the `zsh` `LangVariant`.
- Valid zsh such as `${0:A:h:h}` now parses and prints instead of erroring with `ternary operator missing ? before :`.

**Breaking:** `LangVariant` is now a bit-flag enum (`1 << iota`) to match `mvdan/sh` v3.13, so every numeric value changed. Code using the exported `LangVariant` constants is unaffected; only code passing raw variant numbers needs updating:

- `LangBash`: `0` → `1`
- `LangPOSIX`: `1` → `2`
- `LangMirBSDKorn`: `2` → `4`
- `LangBats`: `3` → `8`
- `LangZsh`: _(new)_ → `16`
- `LangAuto`: `4` → `32`
