import { beforeEach, describe, expect, it } from 'vitest'
import { type Db, openDb } from '#server/auth/db'
import { testDb } from '#server/db/testDb'

const alice = { username: 'alice', partyId: 'alice::1', ledgerUserId: 'wl-alice-x' }

let db: Db

beforeEach(async () => {
  db = openDb(await testDb())
})

describe('openDb', () => {
  it('refuses a second user under a taken name', async () => {
    await db.createUser(alice, 'hash')
    await expect(db.createUser({ ...alice, partyId: 'other::1' }, 'hash')).rejects.toThrow()
  })

  it('resolves a session to its user until it expires', async () => {
    const user = await db.createUser(alice, 'hash')
    await db.createSession('s1', user.id, 1000)
    expect(await db.sessionUser('s1', 999)).toEqual(user)
    expect(await db.sessionUser('s1', 1000)).toBeUndefined()
    await db.purgeSessions(1000)
    expect(await db.sessionUser('s1', 0)).toBeUndefined()
  })

  it('hands an escrow disclosure from one user to another until it is dropped', async () => {
    const escrow = { contractId: 'am1', templateId: 't', createdEventBlob: 'blob' }
    await db.disclosures.put(escrow)
    expect(await db.disclosures.get('am1')).toEqual(escrow)
    expect(await db.disclosures.get('missing')).toBeUndefined()
    await db.disclosures.drop('am1')
    expect(await db.disclosures.get('am1')).toBeUndefined()
  })
})
