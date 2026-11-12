import { invoke, normalizeExports, type InternalOptions } from '../processor.js'
import type { File, ShOptions } from '../types.js'

export type GetWebAssemblySource = () => WebAssemblyBaseSource | WebAssembly.Module

export interface SyncProcessor {
  (text: string, options?: ShOptions): File
  (text: string, options?: ShOptions & { print: true }): string
  (ast: File, options: ShOptions & { originalText: string }): string
}
export type WebAssemblyBaseSource = Buffer | BufferSource

/**
 * Creates a synchronous processor from WASM bytes, a synchronous loader, or a compiled module.
 *
 * The Go runtime is created once and reused. Standard Go WASM uses the normal Go GC, so the
 * instance can serve repeated synchronous calls.
 */
export const getProcessor = (
  getWasm: GetWebAssemblySource | WebAssemblyBaseSource | WebAssembly.Module,
): SyncProcessor => {
  const source = typeof getWasm === 'function' ? getWasm() : getWasm
  const module = source instanceof WebAssembly.Module ? source : new WebAssembly.Module(source)
  const createRuntime = () => {
    const go = new Go()
    const instance = new WebAssembly.Instance(module, go.importObject)
    // Do not await: main blocks in select{}; this resolves only when the Go program exits.
    void go.run(instance)
    return { go, exports: normalizeExports(instance.exports) }
  }
  let runtime = createRuntime()

  function processor(text: string, options?: ShOptions): File
  function processor(text: string, options?: ShOptions & { print: true }): string
  function processor(ast: File, options: ShOptions & { originalText: string }): string
  function processor(textOrAst: File | string, options?: InternalOptions): File | string {
    /* istanbul ignore if -- @preserve */
    if (runtime.go.exited) {
      runtime = createRuntime()
    }
    return invoke(runtime.exports, textOrAst, options)
  }

  return processor
}
