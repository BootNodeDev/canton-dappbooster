// @vitest-environment node
import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  allocationsFrom,
  isRaceLost,
  LEGS,
  openRequests,
  pairForSettle,
  payoutToAllocate,
  proposalsFrom,
  requestIdFor,
  requestsFrom,
  scaled,
  selectInputs,
} from './vault-decisions.mjs'

const VAULT = 'vault-operator::abc'
const DEPOSITOR = 'nando::abc'
const USDX = { admin: 'token-issuer::abc', id: 'USDX' }
const VSH = { admin: VAULT, id: 'VSH' }

const settlement = (id, executor = VAULT) => ({
  executor,
  settlementRef: { cid: null, id },
  requestedAt: '2026-09-10T12:00:00Z',
  allocateBefore: '2026-09-10T13:00:00Z',
  settleBefore: '2026-09-10T14:00:00Z',
  meta: { values: {} },
})

const leg = (amount, sender = DEPOSITOR, receiver = VAULT, instrumentId = USDX) => ({
  sender,
  receiver,
  amount,
  instrumentId,
  meta: { values: {} },
})

const viewEvent = (contractId, viewValue) => ({ contractId, interfaceViews: [{ viewValue }] })

const depositEvent = (contractId, id, amount, executor = VAULT) =>
  viewEvent(contractId, {
    settlement: settlement(id, executor),
    transferLegs: { deposit: leg(amount) },
    meta: { values: {} },
  })

const withdrawEvent = (contractId, id, amount) =>
  viewEvent(contractId, {
    settlement: settlement(id),
    transferLegs: {
      [LEGS.shares]: leg(amount, DEPOSITOR, VAULT, VSH),
      [LEGS.payout]: leg(amount, VAULT, DEPOSITOR, USDX),
    },
    meta: { values: {} },
  })

const allocationEvent = (contractId, id, amount, overrides = {}) =>
  viewEvent(contractId, {
    allocation: {
      settlement: settlement(id),
      transferLegId: 'deposit',
      transferLeg: leg(amount),
      ...overrides,
    },
    holdingCids: [`00escrow-${contractId}`],
    meta: { values: {} },
  })

const legAllocationEvent = (contractId, id, amount, transferLegId) =>
  allocationEvent(contractId, id, amount, {
    transferLegId,
    transferLeg:
      transferLegId === LEGS.shares
        ? leg(amount, DEPOSITOR, VAULT, VSH)
        : leg(amount, VAULT, DEPOSITOR, USDX),
  })

describe('requestIdFor', () => {
  it('carries the proposal it came from, so one tick cannot mint two of the same', () => {
    const stamp = 1757000000000
    assert.notEqual(
      requestIdFor('deposit', '00aaaaaaaaaa11', stamp),
      requestIdFor('deposit', '00bbbbbbbbbb22', stamp),
    )
    assert.equal(requestIdFor('deposit', '00aaaaaaaaaa11', stamp), 'dep-1757000000000-00aaaaaaaa')
  })

  it('names the kind, so a log line says which flow a reference belongs to', () => {
    assert.equal(
      requestIdFor('withdraw', '00aaaaaaaaaa11', 1757000000000),
      'wd-1757000000000-00aaaaaaaa',
    )
  })
})

describe('proposalsFrom', () => {
  it('takes the proposals naming this vault and leaves another vault alone', () => {
    const events = [
      {
        contractId: '00mine',
        createArgument: { amount: '25.0', depositor: DEPOSITOR, vault: VAULT },
      },
      {
        contractId: '00theirs',
        createArgument: { amount: '5.0', depositor: DEPOSITOR, vault: 'vault-2::abc' },
      },
    ]

    assert.deepEqual(proposalsFrom(events, 'deposit', VAULT), [
      { amount: '25.0', contractId: '00mine', kind: 'deposit' },
    ])
  })
})

describe('requestsFrom', () => {
  it('reads the settlement and the leg off the view, not off the template', () => {
    const [request] = requestsFrom([depositEvent('00req', 'dep-1', '25.0')], VAULT)

    assert.equal(request.contractId, '00req')
    assert.equal(request.requestId, 'dep-1')
    assert.equal(request.kind, 'deposit')
    assert.deepEqual(request.settlement, settlement('dep-1'))
    assert.deepEqual(request.legs[LEGS.deposit], leg('25.0'))
  })

  it('reads a withdraw as a withdraw, keeping both of its legs', () => {
    const [request] = requestsFrom([withdrawEvent('00wd', 'wd-1', '15.0')], VAULT)

    assert.equal(request.kind, 'withdraw')
    assert.deepEqual(request.legs[LEGS.shares], leg('15.0', DEPOSITOR, VAULT, VSH))
    assert.deepEqual(request.legs[LEGS.payout], leg('15.0', VAULT, DEPOSITOR, USDX))
  })

  it('drops a request another vault executes', () => {
    assert.deepEqual(
      requestsFrom([depositEvent('00req', 'dep-1', '25.0', 'vault-2::abc')], VAULT),
      [],
    )
  })

  it('drops a request naming no leg it knows', () => {
    const events = [
      viewEvent('00other', {
        settlement: settlement('x-1'),
        transferLegs: { 'some-other-leg': leg('5.0') },
      }),
    ]

    assert.deepEqual(requestsFrom(events, VAULT), [])
  })
})

describe('openRequests', () => {
  const requests = requestsFrom([depositEvent('00req', 'dep-1', '25.0')], VAULT)
  const settleBefore = Date.parse('2026-09-10T14:00:00Z')

  it('keeps a request until its settleBefore and drops it from that instant', () => {
    assert.deepEqual(openRequests(requests, settleBefore - 1), requests)
    assert.deepEqual(openRequests(requests, settleBefore), [])
  })

  it('keeps a request whose deadline does not parse, so the ledger is the one to say no', () => {
    const odd = [{ ...requests[0], settlement: { ...requests[0].settlement, settleBefore: 'x' } }]
    assert.deepEqual(openRequests(odd, settleBefore), odd)
  })
})

describe('allocationsFrom', () => {
  it('carries the escrow and the party that can read it', () => {
    const [allocation] = allocationsFrom([allocationEvent('00alloc', 'dep-1', '25.0')])

    assert.equal(allocation.contractId, '00alloc')
    assert.deepEqual(allocation.escrow, { admin: USDX.admin, cid: '00escrow-00alloc' })
    assert.equal(allocation.requestId, 'dep-1')
    assert.equal(allocation.transferLegId, 'deposit')
  })

  it('names the escrow admin per leg, which differs across a withdraw', () => {
    const [shares] = allocationsFrom([legAllocationEvent('00sh', 'wd-1', '15.0', LEGS.shares)])
    const [payout] = allocationsFrom([legAllocationEvent('00pay', 'wd-1', '15.0', LEGS.payout)])

    assert.equal(shares.escrow.admin, VSH.admin)
    assert.equal(payout.escrow.admin, USDX.admin)
  })

  it('drops an allocation whose leg names no instrument admin', () => {
    const events = [
      viewEvent('00alloc', {
        allocation: { settlement: settlement('dep-1'), transferLegId: 'deposit', transferLeg: {} },
        holdingCids: ['00escrow'],
      }),
    ]

    assert.deepEqual(allocationsFrom(events), [])
  })

  it('drops an allocation holding no escrow to disclose', () => {
    const events = [
      viewEvent('00alloc', {
        allocation: {
          settlement: settlement('dep-1'),
          transferLegId: 'deposit',
          transferLeg: leg('1.0'),
        },
        holdingCids: [],
      }),
    ]

    assert.deepEqual(allocationsFrom(events), [])
  })
})

describe('pairForSettle', () => {
  const requests = requestsFrom([depositEvent('00req', 'dep-1', '25.0')], VAULT)

  it('pairs a request with the allocation funding its deposit leg', () => {
    const allocations = allocationsFrom([allocationEvent('00alloc', 'dep-1', '25.0')])

    assert.deepEqual(pairForSettle({ allocations, requests }), [
      {
        allocationCid: '00alloc',
        escrows: [{ admin: USDX.admin, cid: '00escrow-00alloc' }],
        kind: 'deposit',
        request: requests[0],
      },
    ])
  })

  it('leaves a request nothing has funded', () => {
    assert.deepEqual(pairForSettle({ allocations: [], requests }), [])
  })

  it('refuses an allocation naming another settlement reference', () => {
    const allocations = allocationsFrom([allocationEvent('00alloc', 'dep-2', '25.0')])

    assert.deepEqual(pairForSettle({ allocations, requests }), [])
  })

  it('refuses an allocation for another leg of the same settlement', () => {
    const allocations = allocationsFrom([
      allocationEvent('00alloc', 'dep-1', '25.0', { transferLegId: LEGS.shares }),
    ])

    assert.deepEqual(pairForSettle({ allocations, requests }), [])
  })

  it('refuses an allocation whose leg differs by amount alone', () => {
    const allocations = allocationsFrom([allocationEvent('00alloc', 'dep-1', '24.9999999999')])

    assert.deepEqual(pairForSettle({ allocations, requests }), [])
  })

  it('refuses an allocation whose settlement differs by a deadline alone', () => {
    const drifted = allocationEvent('00alloc', 'dep-1', '25.0', {
      settlement: { ...settlement('dep-1'), settleBefore: '2026-09-10T15:00:00Z' },
    })

    assert.deepEqual(pairForSettle({ allocations: allocationsFrom([drifted]), requests }), [])
  })

  it('waits for both legs of a withdraw, then carries both escrows', () => {
    const withdraws = requestsFrom([withdrawEvent('00wd', 'wd-1', '15.0')], VAULT)
    const shares = legAllocationEvent('00sh', 'wd-1', '15.0', LEGS.shares)
    const payout = legAllocationEvent('00pay', 'wd-1', '15.0', LEGS.payout)

    assert.deepEqual(
      pairForSettle({ allocations: allocationsFrom([shares]), requests: withdraws }),
      [],
    )
    assert.deepEqual(
      pairForSettle({ allocations: allocationsFrom([payout]), requests: withdraws }),
      [],
    )
    assert.deepEqual(
      pairForSettle({ allocations: allocationsFrom([shares, payout]), requests: withdraws }),
      [
        {
          escrows: [
            { admin: VSH.admin, cid: '00escrow-00sh' },
            { admin: USDX.admin, cid: '00escrow-00pay' },
          ],
          kind: 'withdraw',
          payoutAllocationCid: '00pay',
          request: withdraws[0],
          shareAllocationCid: '00sh',
        },
      ],
    )
  })

  it('pairs each of two requests with its own allocation', () => {
    const both = requestsFrom(
      [depositEvent('00r1', 'dep-1', '25.0'), depositEvent('00r2', 'dep-2', '10.0')],
      VAULT,
    )
    const allocations = allocationsFrom([
      allocationEvent('00a2', 'dep-2', '10.0'),
      allocationEvent('00a1', 'dep-1', '25.0'),
    ])

    assert.deepEqual(
      pairForSettle({ allocations, requests: both }).map((pair) => [
        pair.request.requestId,
        pair.allocationCid,
      ]),
      [
        ['dep-1', '00a1'],
        ['dep-2', '00a2'],
      ],
    )
  })
})

describe('payoutToAllocate', () => {
  const withdraws = requestsFrom([withdrawEvent('00wd', 'wd-1', '15.0')], VAULT)

  it('owes nothing until the depositor has funded the shares leg', () => {
    assert.deepEqual(payoutToAllocate({ allocations: [], requests: withdraws }), [])
  })

  it('owes the payout leg once the shares leg is funded, copied out of the view', () => {
    const allocations = allocationsFrom([legAllocationEvent('00sh', 'wd-1', '15.0', LEGS.shares)])

    assert.deepEqual(payoutToAllocate({ allocations, requests: withdraws }), [
      {
        request: withdraws[0],
        spec: {
          settlement: settlement('wd-1'),
          transferLeg: leg('15.0', VAULT, DEPOSITOR, USDX),
          transferLegId: LEGS.payout,
        },
      },
    ])
  })

  it('owes nothing once it has already funded the payout leg', () => {
    const allocations = allocationsFrom([
      legAllocationEvent('00sh', 'wd-1', '15.0', LEGS.shares),
      legAllocationEvent('00pay', 'wd-1', '15.0', LEGS.payout),
    ])

    assert.deepEqual(payoutToAllocate({ allocations, requests: withdraws }), [])
  })

  it('owes nothing on a deposit, whose one leg belongs to the depositor', () => {
    const allocations = allocationsFrom([allocationEvent('00alloc', 'dep-1', '25.0')])
    const deposits = requestsFrom([depositEvent('00req', 'dep-1', '25.0')], VAULT)

    assert.deepEqual(payoutToAllocate({ allocations, requests: deposits }), [])
  })
})

describe('scaled', () => {
  it('compares on the integer, so no float decides whether an amount is covered', () => {
    assert.equal(scaled('1.5'), 15000000000n)
    assert.equal(scaled('0.0000000001'), 1n)
  })

  it('refuses a value it cannot hold exactly', () => {
    assert.equal(scaled('0.00000000001'), undefined)
    assert.equal(scaled('lots'), undefined)
  })
})

describe('selectInputs', () => {
  const holding = (contractId, amount, extra = {}) => ({
    amount,
    contractId,
    instrumentId: USDX,
    isLocked: false,
    ...extra,
  })

  it('takes the largest holdings first and stops once the leg is covered', () => {
    assert.deepEqual(
      selectInputs({
        amount: '15.0',
        holdings: [holding('00a', '10.0'), holding('00b', '40.0'), holding('00c', '5.0')],
        instrumentId: USDX,
      }),
      ['00b'],
    )
  })

  it('reports undefined when the unlocked holdings fall short', () => {
    assert.equal(
      selectInputs({
        amount: '15.0',
        holdings: [holding('00a', '100.0', { isLocked: true }), holding('00b', '5.0')],
        instrumentId: USDX,
      }),
      undefined,
    )
  })

  it('ignores another instrument, even one holding plenty', () => {
    assert.deepEqual(
      selectInputs({
        amount: '15.0',
        holdings: [holding('00a', '100.0', { instrumentId: VSH }), holding('00b', '20.0')],
        instrumentId: USDX,
      }),
      ['00b'],
    )
  })
})

describe('isRaceLost', () => {
  it('reads a consumed contract as another actor having got there first', () => {
    assert.ok(isRaceLost('CONTRACT_NOT_FOUND(11,abc): Contract could not be found'))
    assert.ok(isRaceLost('LOCAL_VERDICT_LOCKED_CONTRACTS(2,abc)'))
  })

  it('leaves anything else to be reported', () => {
    assert.equal(isRaceLost('PERMISSION_DENIED'), false)
    assert.equal(isRaceLost('allocation transfer leg mismatch'), false)
  })
})
