import { describe, expect, it } from 'vitest'
import { wrongNetwork } from '@/utils/network'

const WALLET = 'global-domain::1220f4a17c9e2b6d80c3'
const APP = 'global-domain::12203c8fd51a9e7b2460'

describe('wrongNetwork', () => {
  it('reports nothing when both halves are on the same network', () => {
    expect(wrongNetwork(WALLET, WALLET)).toBeUndefined()
  })

  it('names both networks when they differ', () => {
    expect(wrongNetwork(WALLET, APP)).toEqual({ app: APP, wallet: WALLET })
  })

  // A read that has not landed yet, or a factory row carrying no synchronizer id, must not warn:
  // the two are not known to differ.
  it.each([
    ['the wallet id', undefined, APP],
    ['the app id', WALLET, undefined],
    ['both ids', undefined, undefined],
  ])('reports nothing while %s is missing', (_case, wallet, app) => {
    expect(wrongNetwork(wallet, app)).toBeUndefined()
  })
})
