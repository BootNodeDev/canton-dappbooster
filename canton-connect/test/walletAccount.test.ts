import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { selectPrimaryAccount, toParty } from '../src/lib/walletAccount'

describe('selectPrimaryAccount', () => {
  it('returns undefined for an empty list', () => {
    assert.equal(selectPrimaryAccount([]), undefined)
  })

  it('picks the entry flagged primary', () => {
    const primary = selectPrimaryAccount([
      { partyId: 'a::fp', primary: false },
      { partyId: 'b::fp', primary: true },
      { partyId: 'c::fp' },
    ])
    assert.equal(primary?.partyId, 'b::fp')
  })

  it('falls back to the first entry when nothing is flagged primary', () => {
    const primary = selectPrimaryAccount([{ partyId: 'a::fp' }, { partyId: 'b::fp' }])
    assert.equal(primary?.partyId, 'a::fp')
  })
})

describe('toParty', () => {
  it('maps the wallet account into Party shape and uses the fallback network when missing', () => {
    const party = toParty({ partyId: 'alice::fp', hint: 'alice' }, 'canton:local')
    assert.deepEqual(party, { partyId: 'alice::fp', network: 'canton:local', name: 'alice' })
  })

  it('prefers the account-supplied networkId when present', () => {
    const party = toParty(
      { partyId: 'alice::fp', networkId: 'canton:prod', publicKey: 'pk' },
      'canton:local',
    )
    assert.equal(party.network, 'canton:prod')
    assert.equal(party.publicKey, 'pk')
    assert.equal(party.name, undefined)
  })
})
