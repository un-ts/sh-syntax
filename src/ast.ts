import type { Node } from './types.js'

/** Called when entering a node. Return `false` to skip its children. */
export type WalkEnter = (node: Node, index?: number, parent?: Node) => boolean | void

/** Called after a node's children. Return `false` to stop the walk. */
export type WalkExit = (node: Node, index?: number, parent?: Node) => boolean | void

/** Visitor object form; `exit` is required. */
export interface WalkVisitors {
  enter?: WalkEnter
  exit: WalkExit
}

const isNode = (value: unknown): value is Node =>
  value != null &&
  typeof value === 'object' &&
  typeof (value as { type?: unknown }).type === 'string'

/**
 * Walks the syntax tree in depth-first order.
 *
 * A function visitor is treated as `enter`. An object visitor may provide `enter` and must provide
 * `exit`. `enter` runs before children; `exit` runs after them. Returning `false` from `enter`
 * skips that node's children but still calls `exit`; returning `false` from `exit` stops the walk.
 *
 * `index` is the node's index when it is an element of an array, and `parent` is its nearest
 * enclosing node.
 */
export function walk(value: unknown, enter: WalkEnter): void
export function walk(value: unknown, visitors: WalkVisitors): void
export function walk(value: unknown, enterOrVisitors: WalkEnter | WalkVisitors): void {
  const enter = typeof enterOrVisitors === 'function' ? enterOrVisitors : enterOrVisitors.enter
  const exit = typeof enterOrVisitors === 'function' ? undefined : enterOrVisitors.exit

  const visitEntries = (container: object, parent: Node | undefined): boolean => {
    for (const entry of Object.values(container as Record<string, unknown>)) {
      if (visit(entry, undefined, parent)) {
        return true
      }
    }
    return false
  }

  const visit = (child: unknown, index: number | undefined, parent: Node | undefined): boolean => {
    if (Array.isArray(child)) {
      for (const [i, item] of (child as unknown[]).entries()) {
        if (visit(item, i, parent)) {
          return true
        }
      }
      return false
    }

    if (child == null || typeof child !== 'object') {
      return false
    }

    if (!isNode(child)) {
      return visitEntries(child, parent)
    }

    if (enter?.(child, index, parent) !== false && visitEntries(child, child)) {
      return true
    }
    return exit?.(child, index, parent) === false
  }

  visit(value, undefined, undefined)
}

/** Reports whether an error was caused by incomplete shell source. */
export const isIncomplete = (error: unknown): boolean =>
  Boolean((error as { incomplete?: boolean } | null)?.incomplete)
