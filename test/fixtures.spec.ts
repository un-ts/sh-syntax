import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { parse, print } from 'sh-syntax'

const _dirname =
  typeof __dirname === 'undefined'
    ? path.dirname(fileURLToPath(import.meta.url))
    : __dirname

describe('parser and printer', () => {
  it('should format all fixtures', async () => {
    const fixtures = path.resolve(_dirname, 'fixtures')
    for (const filepath of await fs.promises.readdir(fixtures)) {
      // for (const filepath of ['Dockerfile']) {
      const input = await fs.promises.readFile(
        path.resolve(fixtures, filepath),
        'utf8',
      )

      try {
        const ast = await parse(input, { filepath })
        expect(ast).toMatchSnapshot(filepath)
        expect(
          await print(ast, { filepath, originalText: input }),
        ).toMatchSnapshot(filepath)
      } catch (err: unknown) {
        // eslint-disable-next-line jest/no-conditional-expect
        expect(err).toMatchSnapshot(filepath)
      }
    }
  })
})
