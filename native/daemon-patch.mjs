/* eslint-disable unicorn/no-undeclared-class-members -- AST fields are attached at runtime */
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

const child = spawn('./native/sh-syntax-native', ['--server'], {
  stdio: ['pipe', 'pipe', 'inherit'],
})
const pending = new Map()
const state = { nextId: 0 }

createInterface({ input: child.stdout }).on('line', line => {
  const response = JSON.parse(line)
  pending.get(response.id)?.(response)
  pending.delete(response.id)
})

const request = command =>
  new Promise(resolve => {
    const id = ++state.nextId
    pending.set(id, resolve)
    child.stdin.write(`${JSON.stringify({ id, ...command })}\n`)
  })

const handles = new WeakMap()

class ShellNode {
  patch(field, value) {
    const handle = handles.get(this)
    if (handle === undefined) {
      throw new TypeError('Node is not attached to a native handle')
    }
    // Patches are ordered before the next print request on the same pipe.
    void request({
      op: 'patch',
      handle,
      type: this.type,
      start: this.start,
      end: this.end,
      field,
      value: JSON.stringify(value),
    })
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

export const parse = async (text, filepath = '<input>') => {
  const result = await request({ op: 'parse', text, filepath })
  if (!result.ok) {
    throw new Error(result.error)
  }
  attach(result.ast, result.handle, new WeakSet())
  return result.ast
}

export const print = async ast => {
  const handle = handles.get(ast)
  if (handle === undefined) {
    throw new TypeError('AST is not attached to a native handle')
  }
  const result = await request({ op: 'print', handle })
  if (!result.ok) {
    throw new Error(result.error)
  }
  return result.text
}

export const dispose = async ast => {
  const handle = handles.get(ast)
  if (handle === undefined) {
    return
  }
  await request({ op: 'free', handle })
  handles.delete(ast)
  child.kill()
}
