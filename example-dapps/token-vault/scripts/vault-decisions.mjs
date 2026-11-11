// The vault operator's decisions, with no I/O and no state, so they are tested without a ledger.

import { isDeepStrictEqual } from 'node:util'

export const LEGS = {
  deposit: 'deposit',
  payout: 'withdraw-underlying-out',
  shares: 'withdraw-shares-in',
}

const PRECISION = 10
const DECIMAL = /^\d+(\.\d+)?$/

const PREFIX = { deposit: 'dep', withdraw: 'wd' }

// Carries the proposal it came from, so two accepted in one tick never share a settlement reference.
export const requestIdFor = (kind, contractId, stamp) =>
  `${PREFIX[kind]}-${stamp}-${contractId.slice(0, 10)}`

export const scaled = (value) => {
  const text = String(value)
  if (!DECIMAL.test(text)) return undefined
  const [int, frac = ''] = text.split('.')
  if (frac.length > PRECISION) return undefined
  return BigInt(`${int}${frac.padEnd(PRECISION, '0')}`)
}

const viewOf = (event) => event?.interfaceViews?.[0]?.viewValue

export const proposalsFrom = (events, kind, vault) =>
  events.flatMap((event) => {
    const arg = event?.createArgument
    if (event?.contractId === undefined || arg?.vault !== vault) return []
    return [{ amount: arg.amount, contractId: event.contractId, kind }]
  })

// Off the legs the view names, not the template id: the legs are what the settle choice compares.
const kindOf = (legs) => {
  if (legs[LEGS.deposit] !== undefined) return 'deposit'
  return legs[LEGS.shares] !== undefined ? 'withdraw' : undefined
}

// Every leg is kept, because a withdraw's payout leg is the vault's own to fund.
export const requestsFrom = (events, vault) =>
  events.flatMap((event) => {
    const view = viewOf(event)
    const settlement = view?.settlement
    const legs = view?.transferLegs
    if (event?.contractId === undefined || settlement === undefined || legs === undefined) return []
    if (settlement.executor !== vault) return []
    const kind = kindOf(legs)
    if (kind === undefined) return []
    return [
      {
        contractId: event.contractId,
        kind,
        legs,
        requestId: settlement.settlementRef?.id,
        settlement,
      },
    ]
  })

// Past `settleBefore` the ledger refuses the settle, so a payout escrowed then could never land.
export const openRequests = (requests, nowMs) =>
  requests.filter((request) => {
    const at = Date.parse(request.settlement.settleBefore)
    return Number.isNaN(at) || nowMs < at
  })

// The escrow is readable as the admin of its leg's instrument, which differs across a withdraw.
export const allocationsFrom = (events) =>
  events.flatMap((event) => {
    const view = viewOf(event)
    const allocation = view?.allocation
    const cid = view?.holdingCids?.[0]
    const admin = allocation?.transferLeg?.instrumentId?.admin
    if (event?.contractId === undefined || allocation === undefined) return []
    if (typeof cid !== 'string' || typeof admin !== 'string') return []
    return [
      {
        contractId: event.contractId,
        escrow: { admin, cid },
        requestId: allocation.settlement?.settlementRef?.id,
        settlement: allocation.settlement,
        transferLeg: allocation.transferLeg,
        transferLegId: allocation.transferLegId,
      },
    ]
  })

// The whole of what a settle compares, since a match on the reference alone is a refused settle.
const allocationFor = (allocations, request, legId) =>
  allocations.find(
    (allocation) =>
      allocation.transferLegId === legId &&
      allocation.requestId === request.requestId &&
      isDeepStrictEqual(allocation.settlement, request.settlement) &&
      isDeepStrictEqual(allocation.transferLeg, request.legs[legId]),
  )

// Only once the shares leg is funded, or the vault's USDX sits escrowed for a withdraw nobody funds.
export const payoutToAllocate = ({ allocations, requests }) =>
  requests.flatMap((request) => {
    if (request.kind !== 'withdraw') return []
    if (allocationFor(allocations, request, LEGS.shares) === undefined) return []
    if (allocationFor(allocations, request, LEGS.payout) !== undefined) return []
    const transferLeg = request.legs[LEGS.payout]
    if (transferLeg === undefined) return []
    return [
      {
        request,
        spec: { settlement: request.settlement, transferLeg, transferLegId: LEGS.payout },
      },
    ]
  })

export const pairForSettle = ({ allocations, requests }) =>
  requests.flatMap((request) => {
    if (request.kind === 'deposit') {
      const funded = allocationFor(allocations, request, LEGS.deposit)
      return funded === undefined
        ? []
        : [{ allocationCid: funded.contractId, escrows: [funded.escrow], kind: 'deposit', request }]
    }
    const shares = allocationFor(allocations, request, LEGS.shares)
    const payout = allocationFor(allocations, request, LEGS.payout)
    if (shares === undefined || payout === undefined) return []
    return [
      {
        escrows: [shares.escrow, payout.escrow],
        kind: 'withdraw',
        payoutAllocationCid: payout.contractId,
        request,
        shareAllocationCid: shares.contractId,
      },
    ]
  })

// Largest first so the command names as few as it can, and by id where two are equal.
export const selectInputs = ({ amount, holdings, instrumentId }) => {
  const target = scaled(amount)
  if (target === undefined || target <= 0n) return undefined

  const candidates = holdings
    .filter(
      (holding) =>
        !holding.isLocked &&
        holding.instrumentId?.admin === instrumentId.admin &&
        holding.instrumentId?.id === instrumentId.id,
    )
    .map((holding) => ({ cid: holding.contractId, value: scaled(holding.amount) }))
    .filter((one) => one.value !== undefined)
    .sort((a, b) => (a.value === b.value ? (a.cid < b.cid ? -1 : 1) : a.value > b.value ? -1 : 1))

  const chosen = []
  let running = 0n
  for (const { cid, value } of candidates) {
    if (running >= target) break
    chosen.push(cid)
    running += value
  }
  return running >= target ? chosen : undefined
}

// Every choice here is consuming, so a second actor loses this way rather than spending twice.
export const isRaceLost = (message) =>
  /CONTRACT_NOT_FOUND|CONTRACT_NOT_ACTIVE|LOCAL_VERDICT_LOCKED_CONTRACTS/.test(String(message))
