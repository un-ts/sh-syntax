import type { Node } from './types.js'

/** Called when entering a node. Return `false` to skip its children. */
export type WalkEnter = (node: Node, parent: Node | null, index: number | null) => boolean | void

/**
 * Called after a node's children, or immediately after `enter` skipped them. Return `false` to stop
 * the walk.
 */
export type WalkExit = (node: Node, parent: Node | null, index: number | null) => boolean | void

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
 * `parent` is null at the root; `index` is null when the node is not an element of an array.
 */
export function walk(value: unknown, enter: WalkEnter): void
export function walk(value: unknown, visitors: WalkVisitors): void
export function walk(value: unknown, enterOrVisitors: WalkEnter | WalkVisitors): void {
  const isEnter = typeof enterOrVisitors === 'function'
  const enter = isEnter ? enterOrVisitors : enterOrVisitors.enter
  const exit = isEnter ? undefined : enterOrVisitors.exit

  const visitEntries = (container: object, parent: Node | null): boolean => {
    for (const entry of Object.values(container as Record<string, unknown>)) {
      if (visit(entry, parent, null)) {
        return true
      }
    }
    return false
  }

  const visit = (child: unknown, parent: Node | null, index: number | null): boolean => {
    if (Array.isArray(child)) {
      let i = 0
      for (const item of child as unknown[]) {
        if (visit(item, parent, i)) {
          return true
        }
        i += 1
      }
      return false
    }

    if (child == null || typeof child !== 'object') {
      return false
    }

    if (typeof (child as { type?: unknown }).type !== 'string') {
      return visitEntries(child, parent)
    }

    const node = child as Node
    if (enter?.(node, parent, index) !== false && visitEntries(node, node)) {
      return true
    }
    return exit?.(node, parent, index) === false
  }

  visit(value, null, null)
}

/** Reports whether an error was caused by incomplete shell source. */
export const isIncomplete = (error: unknown): boolean =>
  Boolean((error as { incomplete?: boolean } | null)?.incomplete)
