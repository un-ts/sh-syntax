import type { Node } from './types.js'

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { type?: unknown }).type === 'string'

const childrenOf = (node: Node): Node[] => {
  const children: Node[] = []

  const values: unknown[] = Object.values(node)

  for (const value of values) {
    if (Array.isArray(value)) {
      children.push(...(value as Node[]))
    } else if (isNode(value)) {
      children.push(value)
    }
  }

  if (node.type === 'ParamExp') {
    if (node.exp?.word) {
      children.push(node.exp.word)
    }
    if (node.slice?.offset) {
      children.push(node.slice.offset)
    }
    if (node.slice?.length) {
      children.push(node.slice.length)
    }
    if (node.repl?.orig) {
      children.push(node.repl.orig)
    }
    if (node.repl?.with) {
      children.push(node.repl.with)
    }
  }

  return children
}

/**
 * Walks the syntax tree in depth-first order. Returning `false` from the
 * callback skips the node's children.
 */
export const walk = (
  node: Node,
  walker: (node: Node) => boolean | void,
): void => {
  if (walker(node) === false) {
    return
  }

  for (const child of childrenOf(node)) {
    walk(child, walker)
  }
}

/** Reports whether an error was caused by incomplete shell source. */
export const isIncomplete = (error: unknown): boolean =>
  Boolean((error as { incomplete?: boolean } | null)?.incomplete)
