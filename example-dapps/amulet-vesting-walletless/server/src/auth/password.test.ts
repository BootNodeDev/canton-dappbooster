import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '#server/auth/password'

describe('password hashing', () => {
  it('verifies the password it hashed and nothing else', async () => {
    const stored = await hashPassword('correct horse')
    expect(stored).toMatch(/^scrypt\$16384\$8\$1\$/)
    expect(await verifyPassword('correct horse', stored)).toBe(true)
    expect(await verifyPassword('correct horsE', stored)).toBe(false)
  })

  it('salts, so one password never hashes the same twice', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'))
  })

  it('refuses a stored value it cannot read rather than throwing', async () => {
    expect(await verifyPassword('anything', 'plaintext')).toBe(false)
  })
})
