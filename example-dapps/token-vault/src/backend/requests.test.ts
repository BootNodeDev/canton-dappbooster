import { describe, expect, it, vi } from 'vitest'
import type { LedgerApi } from '@/backend/acs'
import { readVaultRequests } from '@/backend/requests'

const VAULT = 'vault-operator::ns'
const PARTY = 'nando::ns'
const USDX = { admin: 'token-issuer::ns', id: 'USDX' }
const VSH = { admin: VAULT, id: 'VSH' }
const OFFSET = 42

const settlement = (id: string, executor = VAULT): Record<string, unknown> => ({
  allocateBefore: '2026-09-10T13:00:00Z',
  executor,
  meta: { values: {} },
  requestedAt: '2026-09-10T12:00:00Z',
  settleBefore: '2026-09-10T14:00:00Z',
  settlementRef: { cid: null, id },
})

const leg = (
  amount: string,
  sender: string,
  receiver: string,
  instrumentId: { admin: string; id: string },
): Record<string, unknown> => ({
  amount,
  instrumentId,
  meta: { values: {} },
  receiver,
  sender,
})

const viewRow = (contractId: string, viewValue: Record<string, unknown>): unknown => ({
  contractEntry: {
    JsActiveContract: {
      createdEvent: { contractId, interfaceViews: [{ interfaceId: 'pkg:Mod:Iface', viewValue }] },
    },
  },
})

const proposalRow = (contractId: string, createArgument: Record<string, unknown>): unknown => ({
  contractEntry: { JsActiveContract: { createdEvent: { contractId, createArgument } } },
})

const depositRow = (contractId: string, id: string, amount: string, executor = VAULT): unknown =>
  viewRow(contractId, {
    meta: { values: {} },
    settlement: settlement(id, executor),
    transferLegs: { deposit: leg(amount, PARTY, VAULT, USDX) },
  })

const withdrawRow = (contractId: string, id: string, amount: string): unknown =>
  viewRow(contractId, {
    meta: { values: {} },
    settlement: settlement(id),
    transferLegs: {
      'withdraw-shares-in': leg(amount, PARTY, VAULT, VSH),
      'withdraw-underlying-out': leg(amount, VAULT, PARTY, USDX),
    },
  })

const allocationRow = (id: string, transferLegId: string): unknown =>
  viewRow('00alloc', {
    allocation: {
      settlement: settlement(id),
      transferLeg: leg('25.0', PARTY, VAULT, USDX),
      transferLegId,
    },
    holdingCids: ['00locked'],
    meta: { values: {} },
  })

const ledger = (
  rows: {
    allocations?: unknown[]
    deposits?: unknown[]
    requests?: unknown[]
    withdrawals?: unknown[]
  } = {},
): { ledgerApi: LedgerApi; offsets: () => unknown[] } => {
  const offsets: unknown[] = []
  const ledgerApi = vi.fn(async (params) => {
    if (params.resource === '/v2/state/ledger-end') return { offset: OFFSET }
    const body = params.body as {
      activeAtOffset?: unknown
      eventFormat?: {
        filtersByParty?: Record<string, { cumulative?: { identifierFilter?: unknown }[] }>
      }
      filter?: unknown
      verbose?: unknown
    }
    if (body.filter !== undefined || body.verbose !== undefined) {
      throw new Error('DEPRECATED_API_DISABLED')
    }
    offsets.push(body.activeAtOffset)
    const identifier = body.eventFormat?.filtersByParty?.[PARTY]?.cumulative?.[0]
      ?.identifierFilter as
      | {
          InterfaceFilter?: { value?: { interfaceId?: string } }
          TemplateFilter?: { value?: { templateId?: string } }
        }
      | undefined
    const interfaceId = identifier?.InterfaceFilter?.value?.interfaceId
    if (interfaceId === undefined) {
      return identifier?.TemplateFilter?.value?.templateId?.includes('WithdrawProposal') === true
        ? (rows.withdrawals ?? [])
        : (rows.deposits ?? [])
    }
    return interfaceId.includes('AllocationRequestV1')
      ? (rows.requests ?? [])
      : (rows.allocations ?? [])
  })
  return { ledgerApi, offsets: () => offsets }
}

const read = (ledgerApi: LedgerApi) => readVaultRequests(ledgerApi, { party: PARTY, vault: VAULT })

describe('readVaultRequests', () => {
  it('projects a deposit proposal and an accepted deposit request', async () => {
    const { ledgerApi } = ledger({
      deposits: [proposalRow('00prop', { amount: '10.0', depositor: PARTY, vault: VAULT })],
      requests: [depositRow('00req', 'dep-1', '25.0')],
    })

    const { proposals, requests } = await read(ledgerApi)

    expect(proposals).toEqual([{ amount: '10.0', contractId: '00prop', kind: 'deposit' }])
    expect(requests).toEqual([
      {
        allocateBefore: '2026-09-10T13:00:00Z',
        allocated: false,
        amount: '25.0',
        contractId: '00req',
        instrumentId: USDX,
        kind: 'deposit',
        requestedAt: '2026-09-10T12:00:00Z',
        settleBefore: '2026-09-10T14:00:00Z',
        spec: {
          settlement: settlement('dep-1'),
          transferLeg: leg('25.0', PARTY, VAULT, USDX),
          transferLegId: 'deposit',
        },
      },
    ])
  })

  it('reads both proposal templates and labels each by its own', async () => {
    const { ledgerApi } = ledger({
      deposits: [proposalRow('00dep', { amount: '10.0', depositor: PARTY, vault: VAULT })],
      withdrawals: [proposalRow('00wd', { amount: '4.0', depositor: PARTY, vault: VAULT })],
    })

    const { proposals } = await read(ledgerApi)

    expect(proposals).toEqual([
      { amount: '10.0', contractId: '00dep', kind: 'deposit' },
      { amount: '4.0', contractId: '00wd', kind: 'withdraw' },
    ])
  })

  it('takes the leg the party sends, which for a withdraw is the shares leg', async () => {
    const { ledgerApi } = ledger({ requests: [withdrawRow('00wd', 'wd-1', '15.0')] })

    const [request] = (await read(ledgerApi)).requests

    expect(request).toMatchObject({
      amount: '15.0',
      instrumentId: VSH,
      kind: 'withdraw',
    })
    expect(request?.spec.transferLegId).toBe('withdraw-shares-in')
    expect(request?.spec.transferLeg).toEqual(leg('15.0', PARTY, VAULT, VSH))
  })

  it('reports a leg as allocated only when an allocation names its id and that leg', async () => {
    const withLeg = async (id: string, legId: string): Promise<boolean | undefined> => {
      const { ledgerApi } = ledger({
        allocations: [allocationRow(id, legId)],
        requests: [withdrawRow('00wd', 'wd-1', '15.0')],
      })
      return (await read(ledgerApi)).requests[0]?.allocated
    }

    expect(await withLeg('wd-1', 'withdraw-shares-in')).toBe(true)
    expect(await withLeg('wd-1', 'withdraw-underlying-out')).toBe(false)
    expect(await withLeg('wd-2', 'withdraw-shares-in')).toBe(false)
  })

  it('drops a request another vault executes', async () => {
    const { ledgerApi } = ledger({
      requests: [depositRow('00req', 'dep-1', '25.0', 'vault-operator-2::ns')],
    })

    expect((await read(ledgerApi)).requests).toEqual([])
  })

  it('drops a request this party sends no leg of', async () => {
    const { ledgerApi } = ledger({
      requests: [
        viewRow('00other', {
          settlement: settlement('dep-9'),
          transferLegs: { deposit: leg('1.0', 'someone::ns', VAULT, USDX) },
        }),
      ],
    })

    expect((await read(ledgerApi)).requests).toEqual([])
  })

  it('drops a request whose leg it does not recognise', async () => {
    const { ledgerApi } = ledger({
      requests: [
        viewRow('00other', {
          settlement: settlement('x-1'),
          transferLegs: { 'some-other-leg': leg('1.0', PARTY, VAULT, USDX) },
        }),
      ],
    })

    expect((await read(ledgerApi)).requests).toEqual([])
  })

  it('drops a request whose leg names no amount rather than owing a zero', async () => {
    const { amount: _, ...noAmount } = leg('1.0', PARTY, VAULT, USDX)
    const { ledgerApi } = ledger({
      requests: [
        viewRow('00req', { settlement: settlement('dep-1'), transferLegs: { deposit: noAmount } }),
      ],
    })

    expect((await read(ledgerApi)).requests).toEqual([])
  })

  it('drops a proposal naming another vault', async () => {
    const { ledgerApi } = ledger({
      deposits: [
        proposalRow('00prop', { amount: '10.0', depositor: PARTY, vault: 'vault-operator-2::ns' }),
      ],
    })

    expect((await read(ledgerApi)).proposals).toEqual([])
  })

  it('drops a row whose interface view is absent', async () => {
    const { ledgerApi } = ledger({
      requests: [
        {
          contractEntry: {
            JsActiveContract: {
              createdEvent: { contractId: '00req', interfaceViews: [{ viewStatus: {} }] },
            },
          },
        },
      ],
    })

    expect((await read(ledgerApi)).requests).toEqual([])
  })

  it('reads all four snapshots at one offset', async () => {
    const { ledgerApi, offsets } = ledger()

    await read(ledgerApi)

    expect(offsets()).toEqual(['42', '42', '42', '42'])
  })
})
