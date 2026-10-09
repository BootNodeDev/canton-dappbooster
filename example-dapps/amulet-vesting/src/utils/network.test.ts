import { describe, expect, it } from 'vitest'
import { networkLabel, networkStatus } from '@/utils/network'

const WALLET = 'global-domain::1220f4a17c9e2b6d80c3'
const APP = 'global-domain::12203c8fd51a9e7b2460'

describe('networkStatus', () => {
  it('reports ok when the wallet is on the app network', () => {
    expect(networkStatus([APP], APP)).toBe('ok')
  })

  it('reports a mismatch when the wallet cannot reach the app network', () => {
    expect(networkStatus([WALLET], APP)).toBe('wrong')
  })

  // A participant on several synchronizers can still reach the app's, whichever one it lists first.
  it('reports ok when the app network is one of several the wallet has', () => {
    expect(networkStatus([WALLET, APP], APP)).toBe('ok')
  })

  // A read that has not landed yet, or an answer carrying no id, must not warn and must not pass
  // for a checked network either: the two are not known to differ and not known to match.
  it.each([
    ['the app id', [WALLET], undefined],
    ['the wallet ids', [], APP],
  ])('reports unknown while %s is missing', (_case, wallet, app) => {
    expect(networkStatus(wallet, app)).toBe('unknown')
  })
})

describe('networkLabel', () => {
  it('drops the CAIP-2 namespace', () => {
    expect(networkLabel('canton:bootnode-devnet')).toBe('bootnode-devnet')
  })

  it.each([
    ['no namespace', 'localnet', 'localnet'],
    ['nothing after the colon', 'canton:', 'canton:'],
  ])('keeps a label with %s whole', (_case, networkId, expected) => {
    expect(networkLabel(networkId)).toBe(expected)
  })
})
