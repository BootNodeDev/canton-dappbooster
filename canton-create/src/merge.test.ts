import { describe, expect, it } from 'vitest'
import { mergeEnvExample } from '#src/merge'

describe('mergeEnvExample', () => {
  it('appends a block that sets a new key', () => {
    expect(mergeEnvExample('A=1\n', '# B\nB=2\n')).toBe('A=1\n\n# B\nB=2\n')
  })

  it('leaves out a block whose every key is already set', () => {
    expect(mergeEnvExample('A=1\nB=2\n', '# A and B\nA=3\nB=4\n\nC=5\n')).toBe('A=1\nB=2\n\nC=5\n')
  })

  it('does not count a commented-out key as set', () => {
    expect(mergeEnvExample('# A=1\n', 'A=2\n')).toBe('# A=1\n\nA=2\n')
  })
})
