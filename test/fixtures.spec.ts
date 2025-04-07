import fs from 'node:fs'
import path from 'node:path'

import { parse, print } from 'sh-syntax'

describe('parser and printer', () => {
  it('should format all fixtures', async () => {
    const fixtures = path.resolve(import.meta.dirname, 'fixtures')
    for (const filepath of await fs.promises.readdir(fixtures)) {
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
        expect(err).toMatchSnapshot(filepath)
      }
    }
  })
})
