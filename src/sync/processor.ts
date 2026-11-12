import { invoke, normalizeExports, type InternalOptions } from '../internal.js'
import type { WebAssemblyBaseSource } from '../processor.js'
import type { File, ShOptions } from '../types.js'

export type GetWebAssemblySource = () => WebAssemblyBaseSource | WebAssembly.Module

export type GetWebAssembly = GetWebAssemblySource | WebAssemblyBaseSource | WebAssembly.Module

export interface Processor {
  (text: string, options: ShOptions & { print: true }): string
  (text: string, options?: ShOptions): File
  (ast: File, options: ShOptions & { originalText: string }): string
}

/**
 * Creates a synchronous processor from WASM bytes, a synchronous loader, or a compiled module.
 *
 * The Go runtime is created once and reused. Standard Go WASM uses the normal Go GC, so the
 * instance can serve repeated synchronous calls.
 */
export const getProcessor = (getWasm: GetWebAssembly): Processor => {
  const source = typeof getWasm === 'function' ? getWasm() : getWasm
  const module = source instanceof WebAssembly.Module ? source : new WebAssembly.Module(source)

  const createRuntime = () => {
    // oxlint-disable-next-line no-undef -- Go is defined globally by wasm_exec
    const go = new Go()
    const instance = new WebAssembly.Instance(module, go.importObject)
    const exports = normalizeExports(instance.exports)

    if (
      !(exports.mem instanceof WebAssembly.Memory) ||
      typeof (instance.exports as { run?: unknown }).run !== 'function'
    ) {
      throw new TypeError('getProcessor requires a Go WASM instance')
    }

    const runtime: { go: Go; exports: ReturnType<typeof normalizeExports>; error?: unknown } = {
      go,
      exports,
    }

    void go.run(instance).catch(error => {
      runtime.error = error
    })
    return runtime
  }

  let runtime = createRuntime()

  function processor(text: string, options: ShOptions & { print: true }): string
  function processor(text: string, options?: ShOptions): File
  function processor(ast: File, options: ShOptions & { originalText: string }): string
  function processor(textOrAst: File | string, options?: InternalOptions): File | string {
    if (runtime.error) {
      throw runtime.error
    }
    /* istanbul ignore if -- @preserve */
    if (runtime.go.exited) {
      runtime = createRuntime()
    }
    return invoke(runtime.exports, textOrAst, options)
  }

  return processor
}
