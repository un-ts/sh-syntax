import fs from 'node:fs/promises'
import path from 'node:path'

import { parse as parse_, print as print_ } from 'sh-syntax'

export const testFixtures = (parse: typeof parse_, print: typeof print_) =>
  it('should format all fixtures', async () => {
    const fixtures = path.resolve(import.meta.dirname, 'fixtures')
    for (const filepath of await fs.readdir(fixtures)) {
      const input = await fs.readFile(path.resolve(fixtures, filepath), 'utf8')

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
