import { useEffect } from 'react'
import { create } from 'zustand'
import type { CreateVestInput } from '#server/domain/types'
import { vesting } from '@/backend/vesting'
import { useBackend } from '@/providers/Backend'
import { useSession } from '@/providers/Session'
import type { Grant, PendingGrant, VestedClaim } from '@/store/types'
import { isPositive, multiplyByFraction, subtractAmounts, toNumber } from '@/utils/amount'
import { errorText } from '@/utils/errorText'
import { toMs, vestedFraction } from '@/utils/schedule'

// Past the cliff with nothing vested is not_started: in_cliff there read as a cliff still ahead
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
    locked: fraction <= 0,
    status,
  }
}

export const claimAvailable = (claim: VestedClaim): string =>
  subtractAmounts(claim.amount, claim.withdrawn)

export const grantBacking = (grant: Grant): string =>
  subtractAmounts(grant.totalAmount, grant.alreadyWithdrawn)

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

const claimLineage = (claim: VestedClaim): string =>
  JSON.stringify([claim.provider, claim.creator, claim.receiver, claim.amount, claim.title])

// The ACS read has no order, and a claim re-creates a row, so unsorted rows would jump around
const sortBy = <T>(items: T[], key: (item: T) => string): T[] =>
  items
    // Keyed once per item: a key inside the comparator re-runs JSON.stringify on every comparison
    .map((item): [string, T] => [key(item), item])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, item]) => item)

const trackSuccessor = <T extends { id: string }>(
  items: T[],
  cid: string,
  lineageOf: (item: T) => string,
): ((after: T[]) => string | undefined) => {
  const before = items.find((item) => item.id === cid)
  if (before === undefined) {
    return () => undefined
  }
  const lineage = lineageOf(before)
  const seen = new Set(items.map((item) => item.id))
  return (after) => after.find((item) => !seen.has(item.id) && lineageOf(item) === lineage)?.id
}

export type BusyKind = 'accept' | 'cancel' | 'claim'

interface VestingState {
  busy: ReadonlyMap<string, BusyKind>
  claims: VestedClaim[]
  error: string | undefined
  grants: Grant[]
  loading: boolean
  pendingGrants: PendingGrant[]

  accept: (pendingCid: string) => Promise<void>
  cancel: (contractCid: string) => Promise<void>
  claimResidual: (claimCid: string, amount: string) => Promise<string | undefined>
  clear: () => void
  createVesting: (input: CreateVestInput) => Promise<void>
  refresh: () => Promise<void>
  withdraw: (contractCid: string, amount: string) => Promise<string | undefined>
}

// Only the newest refresh may commit: a slow read for the previous party can resolve last
let refreshEpoch = 0

export const useVestingStore = create<VestingState>((set, get) => {
  // Held by the store rather than the page, because leaving the route unmounts a page mid-request.
  const busyWith = async <T>(id: string, kind: BusyKind, run: () => Promise<T>): Promise<T> => {
    set((state) => ({ busy: new Map(state.busy).set(id, kind) }))
    try {
      return await run()
    } finally {
      set((state) => {
        const next = new Map(state.busy)
        next.delete(id)
        return { busy: next }
      })
    }
  }

  return {
    busy: new Map(),
    grants: [],
    pendingGrants: [],
    claims: [],
    loading: false,
    error: undefined,

    clear: () => {
      // So a read in flight for the party being dropped cannot land after it.
      refreshEpoch++
      set({ grants: [], pendingGrants: [], claims: [], loading: false, error: undefined })
    },

    refresh: async () => {
      const epoch = ++refreshEpoch
      set({ loading: true, error: undefined })
      try {
        const view = await vesting.view()
        if (epoch !== refreshEpoch) {
          return
        }
        set({
          grants: sortBy(view.grants, grantLineage),
          pendingGrants: sortBy(view.pendingGrants, (pendingGrant) => pendingGrant.id),
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

    createVesting: async (input) => {
      await vesting.createVesting(input)
      await get().refresh()
    },

    accept: (pendingCid) =>
      busyWith(pendingCid, 'accept', async () => {
        await vesting.accept(pendingCid)
        await get().refresh()
      }),

    withdraw: (contractCid, amount) =>
      busyWith(contractCid, 'claim', async () => {
        const successor = trackSuccessor(get().grants, contractCid, grantLineage)
        await vesting.withdraw(contractCid, amount)
        await get().refresh()
        return successor(get().grants)
      }),

    cancel: (contractCid) =>
      busyWith(contractCid, 'cancel', async () => {
        await vesting.cancel(contractCid)
        await get().refresh()
      }),

    claimResidual: (claimCid, amount) =>
      busyWith(claimCid, 'claim', async () => {
        const successor = trackSuccessor(get().claims, claimCid, claimLineage)
        await vesting.claimResidual(claimCid, amount)
        await get().refresh()
        return successor(get().claims)
      }),
  }
})

export const useVesting = (): { partyId: string; ready: boolean; sessionPending: boolean } => {
  const { ready, sessionPending } = useBackend()
  const { session } = useSession()
  const partyId = session?.partyId ?? ''
  const clear = useVestingStore((state) => state.clear)
  const refresh = useVestingStore((state) => state.refresh)

  useEffect(() => {
    if (!ready || partyId === '') {
      clear()
      return
    }
    void refresh()
  }, [clear, partyId, ready, refresh])

  return { partyId, ready, sessionPending }
}
