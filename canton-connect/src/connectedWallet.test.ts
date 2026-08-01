import { afterEach, describe, expect, it } from 'vitest'
import { clearConnectedWallet, readConnectedWallet, writeConnectedWallet } from './connectedWallet'

const STORAGE_KEY = 'canton-connect:connected-wallet'

describe('connectedWallet', () => {
  afterEach(() => {
    clearConnectedWallet()
  })

  it('round-trips a wallet', () => {
    writeConnectedWallet({ providerId: 'wallet-a', name: 'Wallet A' })

    expect(readConnectedWallet()).toEqual({ providerId: 'wallet-a', name: 'Wallet A' })
  })

  it('reads undefined when nothing is stored', () => {
    expect(readConnectedWallet()).toBe(undefined)
  })

  it('reads undefined for an unparseable record rather than throwing', () => {
    localStorage.setItem(STORAGE_KEY, 'not json')

    expect(readConnectedWallet()).toBe(undefined)
  })

  it('reads undefined for a record missing its fields', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ providerId: 'a' }))

    expect(readConnectedWallet()).toBe(undefined)
  })

  it('clears the record', () => {
    writeConnectedWallet({ providerId: 'wallet-a', name: 'Wallet A' })
    clearConnectedWallet()

    expect(readConnectedWallet()).toBe(undefined)
  })
})
