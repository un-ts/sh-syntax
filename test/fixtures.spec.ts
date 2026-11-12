import { parse, print } from 'sh-syntax'

import { testFixtures } from './fixtures.ts'

describe('parser and printer', () => {
  testFixtures(parse, print)
})
