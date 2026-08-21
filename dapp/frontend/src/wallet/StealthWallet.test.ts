import { afterEach, describe, expect, it, vi } from 'vitest'
import { StealthWallet } from '@/wallet/StealthWallet'

const rpcOk = (result: unknown) =>
  ({ ok: true, json: async () => ({ jsonrpc: '2.0', id: '1', result }) }) as unknown as Response

afterEach(() => {
  vi.restoreAllMocks()
})

describe('StealthWallet.listParties', () => {
  it('maps listAccounts to PartyRef[] with friendly names from the hint', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      rpcOk([
        { partyId: 'vesting-pablo-123::1220a', hint: 'vesting-pablo-123' },
        { partyId: 'vesting-operator-123::1220b', hint: 'vesting-operator-123' },
      ]),
    )
    const wallet = new StealthWallet('http://localhost:3010/rpc')
    const parties = await wallet.listParties()
    expect(parties).toEqual([
      { name: 'pablo', partyId: 'vesting-pablo-123::1220a' },
      { name: 'operator', partyId: 'vesting-operator-123::1220b' },
    ])
  })
})

describe('StealthWallet.execute', () => {
  it('submits via the ledgerApi proxy with actAs/readAs + disclosed contracts', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(rpcOk({ updateId: 'u1' }))
    const wallet = new StealthWallet('http://localhost:3010/rpc')
    await wallet.execute(
      'alice::fp',
      { ExerciseCommand: { x: 1 } } as unknown as import('@/wallet/Wallet').LedgerCommand,
      [{ createdEventBlob: 'b' }] as unknown as import('@/wallet/Wallet').DisclosedContract[],
    )
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string)
    expect(body.method).toBe('ledgerApi')
    expect(body.params.resource).toBe('/v2/commands/submit-and-wait-for-transaction-tree')
    expect(body.params.body.actAs).toEqual(['alice::fp'])
    expect(body.params.body.readAs).toEqual(['alice::fp'])
    expect(body.params.body.commands).toEqual([{ ExerciseCommand: { x: 1 } }])
    expect(body.params.body.disclosedContracts).toEqual([{ createdEventBlob: 'b' }])
  })
})
