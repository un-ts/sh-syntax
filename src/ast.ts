import type { Node } from './types.js'

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { type?: unknown }).type === 'string'

/**
 * Walks the syntax tree in depth-first order. Returning `false` from the
 * callback skips the node's children.
 */
export const walk = (
  value: unknown,
  walker: (node: Node) => boolean | void,
): void => {
  if (Array.isArray(value)) {
    for (const child of value as unknown[]) {
      walk(child, walker)
    }
    return
  }

  if (value === null || typeof value !== 'object') {
    return
  }

  if (isNode(value) && walker(value) === false) {
    return
  }

  const object = value as Record<string, unknown>

  for (const key in object) {
    if (!Object.hasOwn(object, key)) {
      continue
    }
    walk(object[key], walker)
  }
}

/** Reports whether an error was caused by incomplete shell source. */
export const isIncomplete = (error: unknown): boolean =>
  Boolean((error as { incomplete?: boolean } | null)?.incomplete)
