// @vitest-environment node
import assert from 'node:assert/strict'
import { parseEnv } from 'node:util'
import { describe, it } from 'vitest'
import {
  formatRegistryEnv,
  instrumentDrift,
  REGISTRY_PORT,
  REGISTRY_TEMPLATE_IDS,
} from './bootstrap-vesting.mjs'

const block = formatRegistryEnv({
  ledgerApiUrl: 'http://localhost:2975',
  adminParty: 'admin-1::abc',
  port: REGISTRY_PORT,
})

describe('the .env.registry bootstrap writes', () => {
  it('quotes every template id, so a dotenv parse keeps the leading #', () => {
    const parsed = parseEnv(block)
    for (const [key, id] of Object.entries(REGISTRY_TEMPLATE_IDS)) {
      assert.ok(block.split('\n').includes(`${key}='${id}'`))
      assert.equal(parsed[key], id)
      assert.ok(id.startsWith('#canton-token-forge:'), `${key} is not package-name form`)
    }
  })

  it('carries the party and the url only this run knows', () => {
    assert.match(block, /^ADMIN_PARTY=admin-1::abc$/m)
    assert.match(block, /^LEDGER_API_URL=http:\/\/localhost:2975$/m)
    assert.match(block, /^PORT=3013$/m)
  })

  it('leaves the bearer token out, since registry.sh passes it in the environment', () => {
    assert.doesNotMatch(block, /LEDGER_API_TOKEN/)
    assert.doesNotMatch(block, /eyJ[A-Za-z0-9_-]+\./)
  })

  it('holds the registry settings in a fixed order', () => {
    assert.deepEqual(
      block.split('\n').map((line) => line.split('=')[0]),
      ['LEDGER_API_URL', 'ADMIN_PARTY', ...Object.keys(REGISTRY_TEMPLATE_IDS), 'PORT'],
    )
  })
})

// The InstrumentConfig is admin-signed and created once, so a bootstrap that finds one reuses it
// whatever this script now asks for, and saying nothing would make the constants write-once.
describe('the drift between the ledger and the INSTRUMENT constants', () => {
  const onLedger = {
    admin: 'instrument-admin::ns',
    instrumentId: 'DBT',
    name: 'dAppBooster Token',
    symbol: 'DBT',
    decimals: '10',
    faucet: { maxPerTap: '1000.0000000000' },
  }

  it('reports none for the config this script would have created', () => {
    assert.deepEqual(instrumentDrift(onLedger), [])
  })

  it('compares the tap ceiling as a number, since Daml pads a Decimal to its full scale', () => {
    assert.deepEqual(instrumentDrift({ ...onLedger, faucet: { maxPerTap: '5000.0000000000' } }), [
      'maxPerTap is 5000.0000000000, this script asks for 1000.0',
    ])
  })

  it('names every field that differs, and reports a missing faucet as one', () => {
    const drift = instrumentDrift({ ...onLedger, symbol: 'OLD', faucet: undefined })
    assert.deepEqual(drift, [
      'symbol is OLD, this script asks for DBT',
      'maxPerTap is undefined, this script asks for 1000.0',
    ])
  })
})
