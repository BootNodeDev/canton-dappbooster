import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { ACCESS_TIER, accessTier } from '@/provider/methods'

describe('provider method access tiers', () => {
  it('classifies known methods by sensitivity', () => {
    assert.equal(accessTier('getActiveNetwork'), ACCESS_TIER.PUBLIC)
    assert.equal(accessTier('disconnect'), ACCESS_TIER.PUBLIC)
    assert.equal(accessTier('connect'), ACCESS_TIER.CONNECT)
    assert.equal(accessTier('listAccounts'), ACCESS_TIER.IDENTITY)
    assert.equal(accessTier('status'), ACCESS_TIER.IDENTITY)
    assert.equal(accessTier('signMessage'), ACCESS_TIER.RESTRICTED)
    assert.equal(accessTier('prepareExecute'), ACCESS_TIER.RESTRICTED)
    assert.equal(accessTier('ledgerApi'), ACCESS_TIER.RESTRICTED)
  })

  it('normalizes canton_-prefixed methods before classifying', () => {
    assert.equal(accessTier('canton_listAccounts'), ACCESS_TIER.IDENTITY)
    assert.equal(accessTier('canton_prepareSignExecute'), ACCESS_TIER.RESTRICTED)
  })

  it('fails safe: an unknown method is restricted', () => {
    assert.equal(accessTier('someFutureMethod'), ACCESS_TIER.RESTRICTED)
    assert.equal(accessTier('amulet.tap'), ACCESS_TIER.RESTRICTED)
  })
})
