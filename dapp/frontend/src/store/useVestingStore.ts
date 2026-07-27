import { useEffect } from 'react'
import { create } from 'zustand'
import type { CreateVestInput, VestingBackend } from '@/backend/VestingBackend'
import { now } from '@/lib/clock'
import { vestedAmount, vestedFraction } from '@/lib/schedule'
import { useBackend, useParty } from '@/wallet/hooks'
import type { Grant, Proposal, VestedClaim, WithdrawEvent } from './types'

export type GrantStatus = 'in_cliff' | 'vesting' | 'fully_vested'

export interface GrantDerived {
  fraction: number
  vested: number
  claimable: number
  claimed: number
  unvested: number
  status: GrantStatus
}

// Pure projection of a grant at a moment in time. The single source of the
// vested/claimable numbers shown everywhere. Kept identical across the mock→ledger
// swap — components read figures only from here / lib/schedule.
export const deriveGrant = (grant: Grant, nowMs: number): GrantDerived => {
  const fraction = vestedFraction(grant.schedule, nowMs)
  const vested = vestedAmount(grant.schedule, grant.totalAmount, nowMs)
  const claimed = grant.alreadyWithdrawn
  const claimable = Math.max(0, vested - claimed)
  const unvested = Math.max(0, grant.totalAmount - vested)
  const status: GrantStatus =
    fraction <= 0 ? 'in_cliff' : fraction >= 1 ? 'fully_vested' : 'vesting'
  return { fraction, vested, claimable, claimed, unvested, status }
}

interface VestingState {
  grants: Grant[]
  proposals: Proposal[]
  claims: VestedClaim[]
  // Session-local withdraw log: the example surfaced it UI-only and the lite
  // contracts do not retain history; sourcing it from ledger update events is a
  // follow-up.
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
    amount: number,
  ) => Promise<void>
  cancel: (backend: VestingBackend, partyId: string, contractCid: string) => Promise<void>
  claimResidual: (
    backend: VestingBackend,
    partyId: string,
    claimCid: string,
    amount: number,
  ) => Promise<void>
}

const uid = (prefix: string): string => `${prefix}-${crypto.randomUUID().slice(0, 8)}`

const errorText = (err: unknown): string => (err instanceof Error ? err.message : String(err))

export const useVestingStore = create<VestingState>((set, get) => ({
  grants: [],
  proposals: [],
  claims: [],
  history: [],
  loading: false,
  error: undefined,

  refresh: async (backend, partyId) => {
    if (partyId === '') {
      set({ grants: [], proposals: [], claims: [] })
      return
    }
    set({ loading: true, error: undefined })
    try {
      const view = await backend.viewAs(partyId)
      set({
        grants: view.grants,
        proposals: view.proposals,
        claims: view.claims,
        loading: false,
      })
    } catch (err) {
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
