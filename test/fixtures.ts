import fs from 'node:fs/promises'
import path from 'node:path'

import { walk, type File, type ShOptions, parse as parse_ } from 'sh-syntax'

/**
 * Returns a compact node-type histogram. Snapshotting the full tree for the
 * large fixtures would be megabytes of JSON, while the histogram still catches
 * missing or extra nodes.
 */
export const summarize = (ast: File): Record<string, number> => {
  const counts: Record<string, number> = {}
  walk(ast, node => {
    const type = node.type
    counts[type] = (counts[type] ?? 0) + 1
  })
  return counts
}

type Print = (text: string, options?: ShOptions) => Promise<string>

export const testFixtures = (parse: typeof parse_, print: Print) =>
  it('should format all fixtures', { timeout: 30_000 }, async () => {
    const fixtures = path.resolve(import.meta.dirname, 'fixtures')
    const files = await fs.readdir(fixtures)

    const check = async (index: number): Promise<void> => {
      if (index >= files.length) {
        return
      }

      const filepath = files[index]
      const input = await fs.readFile(path.resolve(fixtures, filepath), 'utf8')

      try {
        const ast = await parse(input, { filepath })
        expect(summarize(ast)).toMatchSnapshot(`${filepath} ast`)
        expect(await print(input, { filepath })).toMatchSnapshot(filepath)
      } catch (err: unknown) {
        expect(err).toMatchSnapshot(filepath)
      }

      await check(index + 1)
    }

    await check(0)
  })
