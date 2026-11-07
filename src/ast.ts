import type { Node } from './types.js'

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { type?: unknown }).type === 'string'

const walkValue = (
  value: unknown,
  walker: (node: Node) => boolean | void,
): void => {
  if (Array.isArray(value)) {
    for (const child of value as unknown[]) {
      walkValue(child, walker)
    }
    return
  }

  if (value === null || typeof value !== 'object') {
    return
  }

  if (isNode(value) && walker(value) === false) {
    return
  }

  for (const child of Object.values(value as Record<string, unknown>)) {
    walkValue(child, walker)
  }
}

/**
 * Walks the syntax tree in depth-first order. Returning `false` from the
 * callback skips the node's children.
 */
export const walk = (
  node: Node,
  walker: (node: Node) => boolean | void,
): void => {
  walkValue(node, walker)
}

/** Reports whether an error was caused by incomplete shell source. */
export const isIncomplete = (error: unknown): boolean =>
  Boolean((error as { incomplete?: boolean } | null)?.incomplete)
