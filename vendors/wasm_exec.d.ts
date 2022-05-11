/* eslint-disable unicorn/filename-case */
import _fs from 'fs'

declare global {
  namespace globalThis {
    // eslint-disable-next-line no-var
    var fs: typeof _fs
  }
}
