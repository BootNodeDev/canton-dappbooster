import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatRegistryEnv, REGISTRY_PORT, REGISTRY_TEMPLATE_IDS } from './bootstrap-vesting.mjs'

const block = formatRegistryEnv({
  ledgerApiUrl: 'http://localhost:2975',
  adminParty: 'admin-1::abc',
  port: REGISTRY_PORT,
})

describe('the registry env block bootstrap prints', () => {
  it('quotes every template id, because dotenv reads the leading # as a comment', () => {
    for (const [key, id] of Object.entries(REGISTRY_TEMPLATE_IDS)) {
      assert.match(block, new RegExp(`^${key}='${id}'$`, 'm'))
      assert.ok(id.startsWith('#canton-token-forge:'), `${key} is not package-name form`)
    }
  })

  it('carries the party and the url only this run knows', () => {
    assert.match(block, /^ADMIN_PARTY=admin-1::abc$/m)
    assert.match(block, /^LEDGER_API_URL=http:\/\/localhost:2975$/m)
    assert.match(block, /^PORT=3013$/m)
  })

  it('never prints the bearer token', () => {
    // The block is pasteable by hand, so it names the token rather than carrying
    // it: bootstrap's stdout reaches terminal scrollback and a dev-stack log file.
    assert.match(block, /^LEDGER_API_TOKEN=<[^>]+>$/m)
    assert.doesNotMatch(block, /eyJ[A-Za-z0-9_-]+\./)
  })
})
