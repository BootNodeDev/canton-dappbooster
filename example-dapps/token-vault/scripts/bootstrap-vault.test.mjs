// @vitest-environment node
import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  instrumentConfigArgs,
  instrumentDrift,
  SHARE,
  UNDERLYING,
  vaultArgs,
} from './bootstrap-vault.mjs'

describe('the payloads the vault bootstrap creates', () => {
  it('spells the underlying InstrumentConfig the way the JSON Ledger API takes it', () => {
    assert.deepEqual(instrumentConfigArgs('token-issuer::abc', UNDERLYING), {
      admin: 'token-issuer::abc',
      instrumentId: 'USDX',
      name: 'US Dollar X',
      symbol: 'USDX',
      decimals: '10',
      faucet: { maxPerTap: '1000.0' },
      meta: { values: {} },
    })
  })

  it('sends the share instrument with a null faucet, since an Optional has no omitted form', () => {
    const args = instrumentConfigArgs('vault-operator::abc', SHARE)

    assert.equal(args.faucet, null)
    assert.ok('faucet' in args)
  })

  it('names each Vault leg as an instrument id record, the share one under the vault itself', () => {
    assert.deepEqual(vaultArgs({ issuer: 'token-issuer::abc', vault: 'vault-operator::abc' }), {
      vault: 'vault-operator::abc',
      instrumentId: { admin: 'token-issuer::abc', id: 'USDX' },
      vaultInstrumentId: { admin: 'vault-operator::abc', id: 'VSH' },
    })
  })
})

describe('the drift between the ledger and the instrument constants', () => {
  const onLedger = {
    admin: 'token-issuer::abc',
    instrumentId: 'USDX',
    name: 'US Dollar X',
    symbol: 'USDX',
    decimals: '10',
    faucet: { maxPerTap: '1000.0000000000' },
  }

  it('reports none for the config this script would have created', () => {
    assert.deepEqual(instrumentDrift(onLedger, UNDERLYING), [])
  })

  it('reports none for a share config with no faucet', () => {
    const share = {
      ...onLedger,
      instrumentId: 'VSH',
      name: 'Vault Share',
      symbol: 'VSH',
      faucet: null,
    }
    assert.deepEqual(instrumentDrift(share, SHARE), [])
  })

  it('compares the tap ceiling as a number and names every field that differs', () => {
    assert.deepEqual(
      instrumentDrift(
        { ...onLedger, symbol: 'OLD', faucet: { maxPerTap: '5000.0000000000' } },
        UNDERLYING,
      ),
      [
        'symbol is OLD, this script asks for USDX',
        'maxPerTap is 5000.0000000000, this script asks for 1000.0',
      ],
    )
  })

  it('reports a faucet on the share instrument, which would hand out unbacked shares', () => {
    const share = { ...onLedger, instrumentId: 'VSH', name: 'Vault Share', symbol: 'VSH' }
    assert.deepEqual(instrumentDrift(share, SHARE), [
      'maxPerTap is 1000.0000000000, this script asks for undefined',
    ])
  })
})
