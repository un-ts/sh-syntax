import { invoke, startGoRuntime, type InternalOptions, type GoRuntime } from '../internal.js'
import type { WebAssemblyBaseSource } from '../processor.js'
import type { File, Node, ShOptions, ShPrintOptions } from '../types.js'

export type GetWebAssemblySource = () => WebAssemblyBaseSource | WebAssembly.Module

export type GetWebAssembly = GetWebAssemblySource | WebAssemblyBaseSource | WebAssembly.Module

export interface Processor {
  (text: string, options: ShOptions & { print: true }): string
  (text: string, options?: ShOptions): File
  (node: Node, options?: ShPrintOptions): string
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
    const runtime: GoRuntime & { failure?: { error: unknown } } = startGoRuntime(go, instance)

    /*
     * Do not await the program itself: main blocks in select{} until the Go program exits.
     * Startup rejections are stored and rethrown on the next call.
     */
    void runtime.run.catch((error: unknown) => {
      runtime.failure = { error }
    })
    return runtime
  }

  let runtime = createRuntime()

  function processor(text: string, options: ShOptions & { print: true }): string
  function processor(text: string, options?: ShOptions): File
  function processor(node: Node, options?: ShPrintOptions): string
  function processor(textOrAst: Node | string, options?: InternalOptions): File | string {
    if (runtime.failure) {
      throw runtime.failure.error
    }
    /* istanbul ignore if -- @preserve */
    if (runtime.go.exited) {
      runtime = createRuntime()
    }
    return invoke(runtime.exports, textOrAst, options)
  }

  return processor
}
