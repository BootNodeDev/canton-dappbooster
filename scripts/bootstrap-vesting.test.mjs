import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
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

const scriptsDir = path.dirname(fileURLToPath(import.meta.url))
const devStack = readFileSync(path.join(scriptsDir, 'dev-stack.sh'), 'utf8')

// Read from the array dev-stack.sh declares rather than a copy of it, so the two
// files cannot drift apart while the test still passes.
const devStackKeys = () => {
  const declaration = devStack.match(/REGISTRY_ENV_KEYS=\(([^)]*)\)/)
  assert.ok(declaration, 'dev-stack.sh no longer declares REGISTRY_ENV_KEYS')
  return declaration[1].split(/\s+/).filter((key) => key !== '')
}

describe('the registry env block bootstrap prints', () => {
  it('quotes every template id, because dotenv reads the leading # as a comment', () => {
    const lines = block.split('\n')
    for (const [key, id] of Object.entries(REGISTRY_TEMPLATE_IDS)) {
      assert.ok(lines.includes(`${key}='${id}'`))
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

  it('is a nine-line block pasteable into the registry .env as it stands', () => {
    // dev-stack.sh parses this back out (see the contract tests below), and a human
    // still copies it by hand, so a silently reordered or truncated block breaks both.
    const lines = block.split('\n')
    assert.equal(lines.length, 9)
    assert.doesNotMatch(block, /\n$/)
    assert.deepEqual(
      lines.map((line) => line.split('=')[0]),
      [
        'LEDGER_API_URL',
        'LEDGER_API_TOKEN',
        'ADMIN_PARTY',
        ...Object.keys(REGISTRY_TEMPLATE_IDS),
        'PORT',
      ],
    )
  })
})

describe('the contract between bootstrap and dev-stack.sh', () => {
  it('prints every key dev-stack.sh reads back, exactly once', () => {
    for (const key of devStackKeys()) {
      const occurrences = block.split('\n').filter((line) => line.startsWith(`${key}=`))
      assert.equal(
        occurrences.length,
        1,
        `${key} is read by dev-stack.sh but printed ${occurrences.length} times`,
      )
    }
  })

  it('leaves the bearer token to dev-stack.sh', () => {
    // The one registry variable bootstrap cannot supply: it never sees the token.
    assert.ok(!devStackKeys().includes('LEDGER_API_TOKEN'))
  })

  it('strips to the same template ids the registry checks at boot', () => {
    for (const [key, id] of Object.entries(REGISTRY_TEMPLATE_IDS)) {
      assert.ok(devStackKeys().includes(key), `dev-stack.sh does not read ${key}`)
      const printed = block.split('\n').find((line) => line.startsWith(`${key}=`))
      assert.equal(printed.slice(key.length + 1).replace(/^'|'$/g, ''), id)
    }
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
