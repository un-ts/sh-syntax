import type { Node } from './types.js'

/**
 * Walks the syntax tree in depth-first order. Returning `false` from the
 * callback skips the node's children.
 */
export const walk = (value: unknown, walker: (node: Node) => boolean | void): void => {
  if (Array.isArray(value)) {
    for (const child of value as unknown[]) {
      walk(child, walker)
    }
    return
  }

  if (value == null || typeof value !== 'object') {
    return
  }

  if (typeof (value as { type?: unknown }).type === 'string' && walker(value as Node) === false) {
    return
  }

  for (const key in value) {
    if (!Object.hasOwn(value, key)) {
      continue
    }
    walk((value as Record<string, unknown>)[key], walker)
  }
}

/** Reports whether an error was caused by incomplete shell source. */
export const isIncomplete = (error: unknown): boolean =>
  Boolean((error as { incomplete?: boolean } | null)?.incomplete)
