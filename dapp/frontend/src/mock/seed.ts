import type { PartyRef, VestingView } from '@/backend/VestingBackend'
import { now } from '@/lib/clock'
import type { VestingSchedule } from '@/lib/schedule'

// Fake keys, real shape: `1220` (sha256 multihash) plus 64 hex, the 68 characters a live Canton
// fingerprint has. Anything shorter fails the kit's party-id validation. Tails differ so the
// truncated forms stay distinguishable.
export const MOCK_OPERATOR =
  'operator::12205c09951be5d40dedd05dd52ad7290ecbb75cd5ae0457f0bf3c073b27b0656558'

export const PARTY = {
  alice: 'alice::1220bacae18ee76cbead16253ac8dbc811bdd759f99cbabc84bc4b2354a9f6a5e13c',
  bob: 'bob::1220a827a5f2086fdb471ae2550c3d8075a7036617685fee3426535398aecebf90e1',
  carol: 'carol::1220fdb068b8af0d1b58a93756f01c01fbb54d41f23eb652714b6b287316f7d54895',
  dave: 'dave::1220a79b367e74ccfca039499fed2728eef43a134f8c16354b184eca9475e08c79ac',
} as const

// The party pool the DirectWallet offers on the landing picker.
export const MOCK_PARTIES: PartyRef[] = [
  { name: 'Alice', partyId: PARTY.alice },
  { name: 'Bob', partyId: PARTY.bob },
  { name: 'Carol', partyId: PARTY.carol },
  { name: 'Dave', partyId: PARTY.dave },
]

const DAY = 86_400_000

const at = (nowMs: number, days: number): string => new Date(nowMs + days * DAY).toISOString()

const linear = (nowMs: number, startDays: number, endDays: number): VestingSchedule => ({
  cliff: at(nowMs, startDays),
  curve: { kind: 'linear', start: at(nowMs, startDays), end: at(nowMs, endDays) },
})

// Seed dataset relative to `nowMs` so the dashboard shows a live mix of in-cliff,
// vesting, and fully-vested grants plus a pending proposal and a residual claim —
// all with no wallet-service, Canton, or DAR.
export const seedView = (nowMs: number = now()): VestingView => ({
  grants: [
    {
      id: 'seed-grant-vesting',
      title: 'Engineering grant',
      provider: MOCK_OPERATOR,
      creator: PARTY.alice,
      receiver: PARTY.bob,
      totalAmount: 120_000,
      schedule: linear(nowMs, -180, 185),
      alreadyWithdrawn: 20_000,
      note: '12-month linear with a back-dated start',
    },
    {
      id: 'seed-grant-vested',
      title: 'Advisor grant',
      provider: MOCK_OPERATOR,
      creator: PARTY.dave,
      receiver: PARTY.bob,
      totalAmount: 30_000,
      schedule: linear(nowMs, -400, -35),
      alreadyWithdrawn: 10_000,
      note: 'Fully vested',
    },
    {
      id: 'seed-grant-cliff',
      title: 'New hire grant',
      provider: MOCK_OPERATOR,
      creator: PARTY.alice,
      receiver: PARTY.carol,
      totalAmount: 90_000,
      schedule: linear(nowMs, 30, 395),
      alreadyWithdrawn: 0,
      note: 'Starts in 30 days',
    },
  ],
  proposals: [
    {
      id: 'seed-proposal',
      title: 'Contractor grant',
      provider: MOCK_OPERATOR,
      proposer: PARTY.alice,
      receiver: PARTY.dave,
      totalAmount: 45_000,
      schedule: linear(nowMs, 0, 365),
      note: 'Awaiting your acceptance',
    },
  ],
  claims: [
    {
      id: 'seed-claim',
      title: 'Residual from a cancelled grant',
      provider: MOCK_OPERATOR,
      creator: PARTY.alice,
      receiver: PARTY.carol,
      amount: 8_000,
      withdrawn: 0,
    },
  ],
})
