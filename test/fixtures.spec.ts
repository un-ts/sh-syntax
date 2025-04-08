import { testFixtures } from './fixtures.ts'

import { parse, print } from 'sh-syntax'

describe('parser and printer', () => {
  testFixtures(parse, print)
})
