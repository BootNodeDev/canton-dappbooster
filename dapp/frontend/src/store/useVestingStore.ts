import { useEffect } from 'react'
import { create } from 'zustand'
import type { CreateVestInput, VestingBackend } from '@/backend/VestingBackend'
import { useBackend } from '@/hooks/useBackend'
import { useParty } from '@/hooks/useParty'
import { compareAmounts, multiplyByFraction, subtractAmounts, toNumber } from '@/lib/amount'
import { now } from '@/lib/clock'
import { errorText } from '@/lib/errorText'
import { MIN_GRANT_AMOUNT, vestedFraction } from '@/lib/schedule'
import type { Grant, Proposal, VestedClaim, WithdrawEvent } from './types'

export type GrantStatus = 'in_cliff' | 'vesting' | 'fully_vested'

export interface GrantDerived {
  fraction: number
  vested: string
  claimable: string
  claimed: string
  claimedFraction: number
  unvested: string
  canClaim: boolean
  status: GrantStatus
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
    fraction <= 0 ? 'in_cliff' : fraction >= 1 ? 'fully_vested' : 'vesting'
  return {
    fraction,
    vested,
    claimable,
    claimed,
    claimedFraction,
    unvested,
    canClaim: compareAmounts(claimable, MIN_GRANT_AMOUNT) >= 0,
    status,
  }
}

// `history` is session-local: the lite contracts retain none, so it does not survive a reload.
interface VestingState {
  grants: Grant[]
  proposals: Proposal[]
  claims: VestedClaim[]
  history: WithdrawEvent[]
  loading: boolean
  error: string | undefined

  refresh: (backend: VestingBackend, partyId: string) => Promise<void>
  createVesting: (
    backend: VestingBackend,
    partyId: string,
    input: CreateVestInput,
  ) => Promise<{ disclosedBytes: number }>
  accept: (backend: VestingBackend, partyId: string, proposalCid: string) => Promise<void>
  withdraw: (
    backend: VestingBackend,
    partyId: string,
    contractCid: string,
    amount: string,
  ) => Promise<void>
  cancel: (backend: VestingBackend, partyId: string, contractCid: string) => Promise<void>
  claimResidual: (
    backend: VestingBackend,
    partyId: string,
    claimCid: string,
    amount: string,
  ) => Promise<void>
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

  refresh: async (backend, partyId) => {
    const epoch = ++refreshEpoch
    if (partyId === '') {
      set({ grants: [], proposals: [], claims: [] })
      return
    }
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

  withdraw: async (backend, partyId, contractCid, amount) => {
    await backend.withdraw({ receiver: partyId, contractCid, amount })
    const event: WithdrawEvent = {
      id: uid('wd'),
      grantId: contractCid,
      amount,
      at: new Date(now()).toISOString(),
    }
    set((state) => ({ history: [event, ...state.history] }))
    await get().refresh(backend, partyId)
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

// Wires the store to the context backend + acting party and re-reads the ACS on
// party / mode (backend) change. Components call this once near the top of a page.
export const useVesting = (): {
  backend: VestingBackend
  partyId: string
} => {
  const backend = useBackend()
  const { party } = useParty()
  const partyId = party?.partyId ?? ''
  const refresh = useVestingStore((state) => state.refresh)

  useEffect(() => {
    void refresh(backend, partyId)
  }, [backend, partyId, refresh])

  return { backend, partyId }
}
