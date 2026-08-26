import { useEffect } from 'react'
import { create } from 'zustand'
import type { CreateVestInput, VestingBackend } from '@/backend/VestingBackend'
import { useParty } from '@/hooks/useParty'
import { useBackend } from '@/providers/Backend'
import type { Grant, Proposal, VestedClaim, WithdrawEvent } from '@/store/types'
import { compareAmounts, multiplyByFraction, subtractAmounts, toNumber } from '@/utils/amount'
import { now } from '@/utils/clock'
import { errorText } from '@/utils/errorText'
import { MIN_GRANT_AMOUNT, toMs, vestedFraction } from '@/utils/schedule'

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
    canClaim: compareAmounts(claimable, MIN_GRANT_AMOUNT) >= 0,
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

// `history` is session-local: the lite contracts retain none, so it does not survive a reload.
interface VestingState {
  claims: VestedClaim[]
  error: string | undefined
  grants: Grant[]
  history: WithdrawEvent[]
  loading: boolean
  proposals: Proposal[]

  accept: (backend: VestingBackend, partyId: string, proposalCid: string) => Promise<void>
  cancel: (backend: VestingBackend, partyId: string, contractCid: string) => Promise<void>
  claimResidual: (
    backend: VestingBackend,
    partyId: string,
    claimCid: string,
    amount: string,
  ) => Promise<void>
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

const uid = (prefix: string): string => `${prefix}-${crypto.randomUUID().slice(0, 8)}`

// Only the newest refresh may commit: over the network a slow read for the previous party can
// resolve last and clobber the fresh view.
let refreshEpoch = 0

export const useVestingStore = create<VestingState>((set, get) => ({
  grants: [],
  proposals: [],
  claims: [],
  history: [],
  loading: false,
  error: undefined,

  // Bumps the epoch too, so a read in flight for the party being dropped cannot land after it.
  clear: () => {
    refreshEpoch++
    set({ grants: [], proposals: [], claims: [], history: [], loading: false, error: undefined })
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
        grants: view.grants,
        proposals: view.proposals,
        claims: view.claims,
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

  // Returns the successor's contract id, since the claim replaced the one the caller passed.
  withdraw: async (backend, partyId, contractCid, amount) => {
    const before = get().grants.find((grant) => grant.id === contractCid)
    const lineage = before === undefined ? undefined : grantLineage(before)
    await backend.withdraw({ receiver: partyId, contractCid, amount })
    if (lineage !== undefined) {
      const event: WithdrawEvent = {
        id: uid('wd'),
        lineage,
        amount,
        at: new Date(now()).toISOString(),
      }
      set((state) => ({ history: [event, ...state.history] }))
    }
    await get().refresh(backend, partyId)
    return lineage === undefined
      ? undefined
      : get().grants.find((grant) => grantLineage(grant) === lineage)?.id
  },

  cancel: async (backend, partyId, contractCid) => {
    await backend.cancel({ creator: partyId, contractCid })
    await get().refresh(backend, partyId)
  },

  claimResidual: async (backend, partyId, claimCid, amount) => {
    await backend.claimResidual({ receiver: partyId, claimCid, amount })
    await get().refresh(backend, partyId)
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
