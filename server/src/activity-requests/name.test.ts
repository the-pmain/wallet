import { describe, expect, it } from 'vitest'

import { readOperatorName, REQUESTED_BY_NAME_MAX_LENGTH } from './name.ts'

describe('readOperatorName', () => {
  it('trims a valid name', () => {
    expect(readOperatorName('  Alex  ')).toBe('Alex')
  })

  it('rejects empty and overlong names', () => {
    expect(readOperatorName('   ')).toBeNull()
    expect(readOperatorName('a'.repeat(REQUESTED_BY_NAME_MAX_LENGTH + 1))).toBeNull()
  })
})
