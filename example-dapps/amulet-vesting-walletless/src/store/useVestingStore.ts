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
    canClaim: isPositive(claimable),
    locked: fraction <= 0,
    status,
  }
}

// A residual claim's counterpart to deriveGrant's `claimable`, so what the dashboard shows, sums
// and submits is one rule rather than three copies of a subtraction.
export const claimAvailable = (claim: VestedClaim): string =>
  subtractAmounts(claim.amount, claim.withdrawn)

// What the escrow lock still holds, vested and unvested alike, which is what the withdraw choice
// measures its re-lock floor against. Beside deriveGrant rather than in it, like claimAvailable: it
// does not move with the clock, and only the claim dialog asks for it.
export const grantBacking = (grant: Grant): string =>
  subtractAmounts(grant.totalAmount, grant.alreadyWithdrawn)

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

// A claim archives the contract and re-creates it, so the id the caller pointed at is gone by the
// time the next read lands. Snapshot before the write; the returned function picks the successor out
// of the read after it, as the one entry that read had not seen carrying the same lineage. Two
// contracts a funder made identical share a lineage, which is what `seen` tells apart.
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

// Which exit a contract already has in flight. A dialog can close with its request still out, and
// the control behind it would otherwise offer the same exit on a contract about to be archived.
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

// Only the newest refresh may commit: over the network a slow read for the previous party can
// resolve last and clobber the fresh view.
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

    // Bumps the epoch too, so a read in flight for the party being dropped cannot land after it.
    clear: () => {
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

    // Returns the successor's contract id, since the claim replaced the one the caller passed.
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

    // Like withdraw, except a drained claim is archived outright rather than re-created, so
    // undefined here means there is nothing left to point at.
    claimResidual: (claimCid, amount) =>
      busyWith(claimCid, 'claim', async () => {
        const successor = trackSuccessor(get().claims, claimCid, claimLineage)
        await vesting.claimResidual(claimCid, amount)
        await get().refresh()
        return successor(get().claims)
      }),
  }
})

// Re-reads the ledger whenever the signed-in party or the deployment changes. Components call this
// once near the top of a page; `ready` false means no deployment or nobody signed in yet, so the
// page renders the sign-in card instead — `sessionPending` rides along because that placeholder is
// the only thing every page does with it.
export const useVesting = (): { partyId: string; ready: boolean; sessionPending: boolean } => {
  const { ready, sessionPending } = useBackend()
  const { session } = useSession()
  const partyId = session?.partyId ?? ''
  const clear = useVestingStore((state) => state.clear)
  const refresh = useVestingStore((state) => state.refresh)

  useEffect(() => {
    // Dropping the rows on logout is the point: they belong to the party that has just gone.
    if (!ready || partyId === '') {
      clear()
      return
    }
    void refresh()
  }, [clear, partyId, ready, refresh])

  return { partyId, ready, sessionPending }
}
