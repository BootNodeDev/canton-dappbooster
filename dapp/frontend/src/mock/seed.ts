import type { PartyRef, VestingView } from '@/backend/VestingBackend'
import { now } from '@/lib/clock'
import type { VestingSchedule } from '@/lib/schedule'

// Not real 68-char fingerprints, but long enough to trip display truncation. Tails differ so the
// shortened forms stay distinguishable.
export const MOCK_OPERATOR = 'operator::12205b3e91d7a04c68f2b15e9c37d80a4f6b23e15c98d740a2e63f19'

const PARTY = {
  alice: 'alice::1220df946c5b01ad0f2d2b480f1f43b1d1f2e498f5a49c2f0b1cbb4',
  bob: 'bob::1220a7c31e08f45a92d6108e37cb2f5019ad4e6b73c8f21d09b5e7a3',
  carol: 'carol::12204e8a17c93b06d2f5e84a1b7c3d90f6a2e5b8c1d47f30a9e62b1',
  dave: 'dave::1220c91f37b6d284e05a3c7f18b92d6e4a70c53f81b26d9e04a7f3c2',
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

// Anchored to `nowMs` so the dashboard always shows a live mix of in-cliff, vesting and
// fully-vested grants without a wallet-service, Canton or DAR.
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
