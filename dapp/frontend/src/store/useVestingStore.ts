import { useEffect } from 'react'
import { create } from 'zustand'
import type { CreateVestInput, VestingBackend } from '@/backend/VestingBackend'
import { useParty } from '@/hooks/useParty'
import { useBackend } from '@/providers/Backend'
import type { Grant, Proposal, VestedClaim } from '@/store/types'
import {
  compareAmounts,
  isPositive,
  multiplyByFraction,
  subtractAmounts,
  toNumber,
} from '@/utils/amount'
import { errorText } from '@/utils/errorText'
import { toMs, vestedFraction } from '@/utils/schedule'

// `not_started` is past the cliff with nothing vested yet: a linear curve whose start is still
// ahead, or a milestone curve before its first point. It used to report as in_cliff, which read as
// "the cliff has not passed" on a grant whose cliff had.
export type GrantStatus = 'in_cliff' | 'not_started' | 'vesting' | 'fully_vested'

export interface GrantDerived {
  canClaim: boolean
  claimable: string
  claimed: string
  claimedFraction: number
  fraction: number
  fullyClaimed: boolean
  locked: boolean
  status: GrantStatus
  unvested: string
  vested: string
}

// Pure projection of a grant at a moment in time, and the single source of the vested/claimable
// numbers: components read figures only from here and lib/schedule.
export const deriveGrant = (grant: Grant, nowMs: number): GrantDerived => {
  const fraction = vestedFraction(grant.schedule, nowMs)
  const vested = multiplyByFraction(grant.totalAmount, fraction)
  const claimed = grant.alreadyWithdrawn
  const claimable = subtractAmounts(vested, claimed)
  const unvested = subtractAmounts(grant.totalAmount, vested)
  // A ratio for a progress bar, so a float is the right type here.
  const total = toNumber(grant.totalAmount)
  const claimedFraction = total === 0 ? 0 : toNumber(claimed) / total
  const status: GrantStatus =
    fraction >= 1
      ? 'fully_vested'
      : fraction > 0
        ? 'vesting'
        : nowMs < toMs(grant.schedule.cliff)
          ? 'in_cliff'
          : 'not_started'
  return {
    fraction,
    vested,
    claimable,
    claimed,
    claimedFraction,
    unvested,
    canClaim: isPositive(claimable),
    fullyClaimed: compareAmounts(claimed, grant.totalAmount) >= 0,
    locked: fraction <= 0,
    status,
  }
}

// A residual claim's counterpart to deriveGrant's `claimable`, so what the dashboard shows, sums
// and submits is one rule rather than three copies of a subtraction.
export const claimAvailable = (claim: VestedClaim): string =>
  subtractAmounts(claim.amount, claim.withdrawn)

// A claim archives the grant and re-creates it with `claimed` raised, so its contract id changes
// under the UI. Everything else is preserved, which is what identifies the successor for a URL and
// for the withdraw history.
export const grantLineage = (grant: Grant): string =>
  JSON.stringify([
    grant.provider,
    grant.creator,
    grant.receiver,
    grant.totalAmount,
    grant.schedule,
    grant.title,
    grant.note,
  ])

// A claim archives the claim and re-creates it with `withdrawn` raised, so the same reasoning as
// grantLineage applies: identity is everything but the moving figure.
const claimLineage = (claim: VestedClaim): string =>
  JSON.stringify([claim.provider, claim.creator, claim.receiver, claim.amount, claim.title])

// The ACS read carries no order guarantee and a claim replaces the contract, so an unsorted view
// makes rows jump position the moment their figures change. The key is computed once per item
// rather than inside the comparator, which called it O(log n) times on a full JSON.stringify.
const sortBy = <T>(items: T[], key: (item: T) => string): T[] =>
  items
    .map((item): [string, T] => [key(item), item])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, item]) => item)

interface VestingState {
  claims: VestedClaim[]
  error: string | undefined
  grants: Grant[]
  loading: boolean
  proposals: Proposal[]

  accept: (backend: VestingBackend, partyId: string, proposalCid: string) => Promise<void>
  cancel: (backend: VestingBackend, partyId: string, contractCid: string) => Promise<void>
  claimResidual: (
    backend: VestingBackend,
    partyId: string,
    claimCid: string,
    amount: string,
  ) => Promise<string | undefined>
  clear: () => void
  createVesting: (
    backend: VestingBackend,
    partyId: string,
    input: CreateVestInput,
  ) => Promise<{ disclosedBytes: number }>
  refresh: (backend: VestingBackend, partyId: string) => Promise<void>
  withdraw: (
    backend: VestingBackend,
    partyId: string,
    contractCid: string,
    amount: string,
  ) => Promise<string | undefined>
}

// Only the newest refresh may commit: over the network a slow read for the previous party can
// resolve last and clobber the fresh view.
let refreshEpoch = 0

export const useVestingStore = create<VestingState>((set, get) => ({
  grants: [],
  proposals: [],
  claims: [],
  loading: false,
  error: undefined,

  // Bumps the epoch too, so a read in flight for the party being dropped cannot land after it.
  clear: () => {
    refreshEpoch++
    set({ grants: [], proposals: [], claims: [], loading: false, error: undefined })
  },

  refresh: async (backend, partyId) => {
    const epoch = ++refreshEpoch
    set({ loading: true, error: undefined })
    try {
      const view = await backend.viewAs(partyId)
      if (epoch !== refreshEpoch) {
        return
      }
      set({
        grants: sortBy(view.grants, grantLineage),
        proposals: sortBy(view.proposals, (proposal) => proposal.id),
        claims: sortBy(view.claims, claimLineage),
        loading: false,
      })
    } catch (err) {
      if (epoch !== refreshEpoch) {
        return
      }
      set({ loading: false, error: errorText(err) })
    }
  },

  createVesting: async (backend, partyId, input) => {
    const result = await backend.createVesting(input)
    await get().refresh(backend, partyId)
    return result
  },

  accept: async (backend, partyId, proposalCid) => {
    await backend.accept({ receiver: partyId, proposalCid })
    await get().refresh(backend, partyId)
  },

  // Returns the successor's contract id, since the claim replaced the one the caller passed. A
  // grant the funder made identical shares the lineage, so the successor is the match whose id the
  // read before the claim had not seen.
  withdraw: async (backend, partyId, contractCid, amount) => {
    const before = get().grants.find((grant) => grant.id === contractCid)
    const lineage = before === undefined ? undefined : grantLineage(before)
    const seen = new Set(get().grants.map((grant) => grant.id))
    await backend.withdraw({ receiver: partyId, contractCid, amount })
    await get().refresh(backend, partyId)
    return lineage === undefined
      ? undefined
      : get().grants.find((grant) => !seen.has(grant.id) && grantLineage(grant) === lineage)?.id
  },

  cancel: async (backend, partyId, contractCid) => {
    await backend.cancel({ creator: partyId, contractCid })
    await get().refresh(backend, partyId)
  },

  // Like withdraw: the claim is replaced, and a drained one is archived outright, so the successor
  // is what the caller can point at and undefined means there is nothing left to point at.
  claimResidual: async (backend, partyId, claimCid, amount) => {
    const before = get().claims.find((claim) => claim.id === claimCid)
    const lineage = before === undefined ? undefined : claimLineage(before)
    const seen = new Set(get().claims.map((claim) => claim.id))
    await backend.claimResidual({ receiver: partyId, claimCid, amount })
    await get().refresh(backend, partyId)
    return lineage === undefined
      ? undefined
      : get().claims.find((claim) => !seen.has(claim.id) && claimLineage(claim) === lineage)?.id
  },
}))

// Wires the store to the context backend + acting party and re-reads the ACS whenever either
// changes. Components call this once near the top of a page; an undefined backend means no
// deployment or no wallet session yet, so the page renders a connect placeholder instead.
export const useVesting = (): {
  backend: VestingBackend | undefined
  partyId: string
} => {
  const { backend } = useBackend()
  const { party } = useParty()
  const partyId = party?.partyId ?? ''
  const clear = useVestingStore((state) => state.clear)
  const refresh = useVestingStore((state) => state.refresh)

  useEffect(() => {
    // Dropping the rows on disconnect is the point: they belong to the party that has just gone.
    if (backend === undefined || partyId === '') {
      clear()
      return
    }
    void refresh(backend, partyId)
  }, [backend, clear, partyId, refresh])

  return { backend, partyId }
}
