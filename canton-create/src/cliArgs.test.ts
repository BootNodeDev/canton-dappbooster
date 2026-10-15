import { describe, expect, it } from 'vitest'
import { parseCliArgs } from '#src/cliArgs'

describe('parseCliArgs', () => {
  it('reads a flag after the -- pnpm forwards', () => {
    const { values, directory } = parseCliArgs(['my-app', '--', '--localnet'])

    expect(directory).toBe('my-app')
    expect(values.localnet).toBe(true)
  })

  it('refuses a second directory', () => {
    expect(() => parseCliArgs(['my-app', 'other'])).toThrow(
      'Expected one directory, got: my-app other',
    )
  })
})
