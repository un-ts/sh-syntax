import type { Node } from './types.js'

const isNode = (value: Record<string, unknown>): boolean =>
  typeof value.type === 'string'

/**
 * Walks the syntax tree in depth-first order. Returning `false` from the
 * callback skips the node's children.
 */
export const walk = (
  value: unknown,
  walker: (node: Node) => boolean | void,
): void => {
  if (Array.isArray(value)) {
    for (const item of value as unknown[]) {
      walk(item, walker)
    }
    return
  }

  if (value === null || typeof value !== 'object') {
    return
  }

  const object = value as Record<string, unknown>

  if (isNode(object) && walker(object as unknown as Node) === false) {
    return
  }

  for (const [key, child] of Object.entries(object)) {
    if (key === 'type' || key === 'start' || key === 'end') {
      continue
    }
    walk(child, walker)
  }
}

/** Prints a debug representation of a syntax node. */
export const debugPrint = (node: Node): void => {
  console.log(JSON.stringify(node, null, 2))
}

/** Reports whether an error was caused by incomplete shell source. */
export const isIncomplete = (error: unknown): boolean =>
  Boolean((error as { incomplete?: boolean } | null)?.incomplete)
