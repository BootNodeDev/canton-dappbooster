import { describe, expect, it } from 'vitest'
import { wrongNetwork } from '@/utils/network'

const WALLET = 'global-domain::1220f4a17c9e2b6d80c3'
const APP = 'global-domain::12203c8fd51a9e7b2460'

describe('wrongNetwork', () => {
  it('reports nothing when the wallet is on the app network', () => {
    expect(wrongNetwork([APP], APP)).toBeUndefined()
  })

  it('names both networks when the wallet cannot reach the app one', () => {
    expect(wrongNetwork([WALLET], APP)).toEqual({ app: APP, wallet: WALLET })
  })

  // A participant on several synchronizers submits to the app's whichever one it lists first.
  it('reports nothing when the app network is one of several the wallet has', () => {
    expect(wrongNetwork([WALLET, APP], APP)).toBeUndefined()
  })

  // A read that has not landed yet, or an answer carrying no id, must not warn: the two are not
  // known to differ.
  it.each([
    ['the app id', [WALLET], undefined],
    ['the wallet ids', [], APP],
    ['both', [], undefined],
  ])('reports nothing while %s is missing', (_case, wallet, app) => {
    expect(wrongNetwork(wallet, app)).toBeUndefined()
  })
})
