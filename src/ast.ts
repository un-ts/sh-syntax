import type { Node } from './types.js'

/** Called when entering a node. Return `false` to skip its children. */
export type WalkEnter = (
  node: Node,
  parent: Node | null,
  prop: string | null,
  index: number | null,
) => boolean | void

/**
 * Called after a node's children, or immediately after `enter` skipped them. Return `false` to stop
 * the walk.
 */
export type WalkExit = (
  node: Node,
  parent: Node | null,
  prop: string | null,
  index: number | null,
) => boolean | void

/** Visitor object form; `exit` is required. */
export interface WalkVisitors {
  enter?: WalkEnter
  exit: WalkExit
}

/**
 * Walks the syntax tree in depth-first order.
 *
 * A function visitor is treated as `enter`. An object visitor may provide `enter` and must provide
 * `exit`. `enter` runs before children; `exit` runs after them. Returning `false` from `enter`
 * skips that node's children but still calls `exit`; returning `false` from `exit` stops the walk.
 *
 * `parent` is null at the root. `prop` is the key in the nearest enclosing object (which may be a
 * non-node wrapper), and `index` is its array index; both are null when absent.
 *
 * Traversal is not a snapshot of the whole tree: a container's object entries are captured when the
 * walk reaches that container, after its `enter` callback. Edits made before then are seen, but
 * replacing a property after its container was captured does not affect that walk. Mutating arrays
 * while they are being walked is unspecified; collect structural edits and apply them after the
 * walk.
 */
export function walk(value: unknown, enter: WalkEnter): void
export function walk(value: unknown, visitors: WalkVisitors): void
export function walk(value: unknown, enterOrVisitors: WalkEnter | WalkVisitors): void {
  const isEnter = typeof enterOrVisitors === 'function'
  const enter = isEnter ? enterOrVisitors : enterOrVisitors.enter
  const exit = isEnter ? null : enterOrVisitors.exit

  type WalkTask =
    | {
        kind: 'value'
        child: unknown
        parent: Node | null
        prop: string | null
        index: number | null
      }
    | { kind: 'entries'; entries: [string, unknown][]; parent: Node | null }
    | { kind: 'array'; array: unknown[]; index: number; parent: Node | null; prop: string | null }
    | {
        kind: 'exit'
        node: Node
        parent: Node | null
        prop: string | null
        index: number | null
      }

  const stack: WalkTask[] = [{ kind: 'value', child: value, parent: null, prop: null, index: null }]
  while (stack.length > 0) {
    const task = stack.pop()!
    if (task.kind === 'exit') {
      if (exit?.(task.node, task.parent, task.prop, task.index) === false) {
        return
      }
      continue
    }
    if (task.kind === 'entries') {
      for (let index = task.entries.length - 1; index >= 0; index--) {
        const [prop, child] = task.entries[index]!
        stack.push({ kind: 'value', child, parent: task.parent, prop, index: null })
      }
      continue
    }
    if (task.kind === 'array') {
      if (task.index >= task.array.length) {
        continue
      }
      stack.push({ ...task, index: task.index + 1 })
      stack.push({
        kind: 'value',
        child: task.array[task.index],
        parent: task.parent,
        prop: task.prop,
        index: task.index,
      })
      continue
    }

    const { child, parent, prop, index } = task
    if (Array.isArray(child)) {
      stack.push({ kind: 'array', array: child, index: 0, parent, prop })
      continue
    }
    if (child == null || typeof child !== 'object') {
      continue
    }
    if (typeof (child as { type?: unknown }).type !== 'string') {
      stack.push({ kind: 'entries', entries: Object.entries(child), parent })
      continue
    }

    const node = child as Node
    const enterResult = enter?.(node, parent, prop, index)
    stack.push({ kind: 'exit', node, parent, prop, index })
    if (enterResult !== false) {
      stack.push({ kind: 'entries', entries: Object.entries(node), parent: node })
    }
  }
}

/** Reports whether an error was caused by incomplete shell source. */
export const isIncomplete = (error: unknown): boolean =>
  Boolean((error as { incomplete?: boolean } | null)?.incomplete)
