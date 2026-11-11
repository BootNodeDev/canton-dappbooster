import { describe, expect, it } from 'vitest'
import type { VaultRequest } from '@/backend/requests'
import { queueRows, requestState } from '@/utils/requestState'

const NOON = Date.parse('2026-09-10T12:00:00Z')
const HOUR = 3_600_000

const request = (overrides: Partial<VaultRequest> = {}): VaultRequest => ({
  allocateBefore: '2026-09-10T13:00:00Z',
  allocated: false,
  amount: '25.0',
  contractId: '00req',
  instrumentId: { admin: 'token-issuer::ns', id: 'USDX' },
  kind: 'deposit',
  requestId: 'dep-1',
  requestedAt: '2026-09-10T12:00:00Z',
  settleBefore: '2026-09-10T14:00:00Z',
  spec: { settlement: {}, transferLeg: {}, transferLegId: 'deposit' },
  ...overrides,
})

describe('requestState', () => {
  it('awaits the allocation while the window is open', () => {
    expect(requestState(request(), NOON)).toBe('awaiting_allocation')
  })

  it('settles once the leg is funded, which is the vault turn', () => {
    expect(requestState(request({ allocated: true }), NOON)).toBe('settling')
  })

  it('expires on allocateBefore while unfunded, and on settleBefore once funded', () => {
    const past = NOON + 90 * 60 * 1000

    expect(requestState(request(), past)).toBe('expired')
    expect(requestState(request({ allocated: true }), past)).toBe('settling')
    expect(requestState(request({ allocated: true }), NOON + 3 * HOUR)).toBe('expired')
  })

  it('expires exactly at the deadline, which is the instant the choice is refused', () => {
    expect(requestState(request(), Date.parse('2026-09-10T13:00:00Z'))).toBe('expired')
    expect(requestState(request(), Date.parse('2026-09-10T13:00:00Z') - 1)).toBe(
      'awaiting_allocation',
    )
  })

  it('treats a deadline it cannot parse as still open', () => {
    expect(requestState(request({ allocateBefore: 'never' }), NOON)).toBe('awaiting_allocation')
  })
})

describe('queueRows', () => {
  it('carries the kind through, which is the only thing that tells the two apart on a row', () => {
    const rows = queueRows(
      {
        proposals: [{ amount: '4.0', contractId: '00wd', kind: 'withdraw' }],
        requests: [request({ contractId: '00r', kind: 'withdraw', requestId: 'wd-1' })],
      },
      NOON,
    )

    expect(rows.map((row) => [row.stage, row.kind, row.action])).toEqual([
      ['proposal', 'withdraw', 'cancel'],
      ['request', 'withdraw', 'allocate'],
    ])
  })

  it('owes a cancel on a proposal and an allocate on an open request', () => {
    const rows = queueRows(
      {
        proposals: [{ amount: '10.0', contractId: '00prop', kind: 'deposit' }],
        requests: [request()],
      },
      NOON,
    )

    expect(rows).toEqual([
      {
        action: 'cancel',
        amount: '10.0',
        contractId: '00prop',
        kind: 'deposit',
        proposal: { amount: '10.0', contractId: '00prop', kind: 'deposit' },
        stage: 'proposal',
        state: 'awaiting_vault',
      },
      {
        action: 'allocate',
        amount: '25.0',
        contractId: '00req',
        kind: 'deposit',
        request: request(),
        stage: 'request',
        state: 'awaiting_allocation',
      },
    ])
  })

  it('owes nothing on a request that is settling or dead', () => {
    const rows = queueRows(
      {
        proposals: [],
        requests: [
          request({ allocated: true }),
          request({ contractId: '00b', requestId: 'dep-0' }),
        ],
      },
      NOON + 3 * HOUR,
    )

    expect(rows.map((row) => [row.state, row.action])).toEqual([
      ['expired', 'none'],
      ['expired', 'none'],
    ])
  })

  it('puts proposals first and orders requests newest first', () => {
    const rows = queueRows(
      {
        proposals: [
          { amount: '1.0', contractId: '00b', kind: 'deposit' },
          { amount: '2.0', contractId: '00c', kind: 'withdraw' },
        ],
        requests: [
          request({ contractId: '00r1', requestId: 'dep-1700000000001' }),
          request({ contractId: '00r2', requestId: 'dep-1700000000002' }),
        ],
      },
      NOON,
    )

    expect(rows.map((row) => row.contractId)).toEqual(['00c', '00b', '00r2', '00r1'])
  })
})
