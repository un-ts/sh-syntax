/* eslint-disable unicorn/no-undeclared-class-members -- AST fields are attached at runtime */
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const binding = require('./linux-x64-gnu/build/Release/sh_syntax_binding.node')
const handles = new WeakMap()

class ShellNode {
  patch(field, value) {
    const handle = handles.get(this)
    if (handle === undefined) {
      throw new TypeError('Node is not attached to a native handle')
    }

    const result = JSON.parse(
      binding.patchScalar(
        handle,
        this.type,
        this.start,
        this.end,
        field,
        JSON.stringify(value),
      ),
    )
    if (!result.ok) {
      throw new Error(result.error)
    }

    this[field] = value
    return this
  }
}

const nodePrototype = ShellNode.prototype

const attach = (value, handle, visited) => {
  if (Array.isArray(value)) {
    for (const item of value) {
      attach(item, handle, visited)
    }
    return
  }

  if (
    typeof value !== 'object' ||
    value === null ||
    typeof value.type !== 'string' ||
    visited.has(value)
  ) {
    return
  }
  visited.add(value)

  Object.setPrototypeOf(value, nodePrototype)
  handles.set(value, handle)
  for (const child of Object.values(value)) {
    attach(child, handle, visited)
  }
}

export const parse = (text, filepath = '<input>') => {
  const result = JSON.parse(binding.parseHandle(text, filepath))
  if (!result.ok) {
    throw new Error(result.error)
  }
  attach(result.ast, result.handle, new WeakSet())
  return result.ast
}

export const print = ast => {
  const handle = handles.get(ast)
  if (handle === undefined) {
    throw new TypeError('AST is not attached to a native handle')
  }
  const result = JSON.parse(binding.printHandle(handle))
  if (!result.ok) {
    throw new Error(result.error)
  }
  return result.text
}

export const dispose = ast => {
  const handle = handles.get(ast)
  if (handle === undefined) {
    return
  }
  binding.freeHandle(handle)
  handles.delete(ast)
}
