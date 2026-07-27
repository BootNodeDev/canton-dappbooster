import type { PartyRef, VestingView } from '@/backend/VestingBackend'
import { now } from '@/lib/clock'
import type { VestingSchedule } from '@/lib/schedule'

// The mock deployment's operator (contract provider). Internal to the mock; not a
// selectable party.
export const MOCK_OPERATOR = 'operator::mock-vesting'

const PARTY = {
  alice: 'alice::mock-vesting',
  bob: 'bob::mock-vesting',
  carol: 'carol::mock-vesting',
  dave: 'dave::mock-vesting',
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
