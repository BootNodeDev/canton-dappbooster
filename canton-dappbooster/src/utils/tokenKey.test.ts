import { describe, expect, it } from 'vitest'
import { tokenKey } from '#src/utils/tokenKey'

describe('tokenKey', () => {
  it('joins the admin party and the id', () => {
    expect(tokenKey({ admin: 'DSO::1220ab', id: 'Amulet' })).toBe('DSO::1220ab/Amulet')
  })

  it('tells two registries issuing the same id apart', () => {
    expect(tokenKey({ admin: 'circle::1220cd', id: 'USDC' })).not.toBe(
      tokenKey({ admin: 'other::1220ef', id: 'USDC' }),
    )
  })
})
