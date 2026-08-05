import type { CreateVestInput, Mode, VestingBackend, VestingView } from '@/backend/VestingBackend'
import { now } from '@/lib/clock'
import { MIN_GRANT_AMOUNT, vestedAmount } from '@/lib/schedule'
import type { Grant, Proposal, VestedClaim } from '@/store/types'
import { MOCK_OPERATOR } from './seed'

const mockId = (prefix: string): string => `${prefix}-${crypto.randomUUID().slice(0, 8)}`

// A party is a stakeholder of a contract if it is the provider, the funder, or the
// receiver — the rows an ACS read as that party would return.
const isStakeholder = (
  partyId: string,
  provider: string,
  funder: string,
  receiver: string,
): boolean => partyId === provider || partyId === funder || partyId === receiver

// In-memory VestingBackend, so the whole app is explorable with no wallet-service, Canton or DAR.
// Swap it for LiteBackend by dropping a real vesting-lite-parties.json into /public.
export class MockBackend implements VestingBackend {
  readonly mode: Mode = 'lite'
  private grants: Grant[]
  private proposals: Proposal[]
  private claims: VestedClaim[]

  constructor(initial: VestingView) {
    this.grants = [...initial.grants]
    this.proposals = [...initial.proposals]
    this.claims = [...initial.claims]
  }

  async isAvailable(): Promise<boolean> {
    return true
  }

  async viewAs(partyId: string): Promise<VestingView> {
    return {
      grants: this.grants.filter((g) => isStakeholder(partyId, g.provider, g.creator, g.receiver)),
      proposals: this.proposals.filter((p) =>
        isStakeholder(partyId, p.provider, p.proposer, p.receiver),
      ),
      claims: this.claims.filter((c) => isStakeholder(partyId, c.provider, c.creator, c.receiver)),
    }
  }

  async createVesting(args: CreateVestInput): Promise<{ disclosedBytes: number }> {
    if (args.totalAmount < MIN_GRANT_AMOUNT) {
      throw new Error(`Grant total must be at least ${MIN_GRANT_AMOUNT} CC`)
    }
    const proposal: Proposal = {
      id: mockId('proposal'),
      title: args.title,
      provider: MOCK_OPERATOR,
      proposer: args.proposer,
      receiver: args.receiver,
      totalAmount: args.totalAmount,
      schedule: args.schedule,
      note: args.note,
    }
    this.proposals = [proposal, ...this.proposals]
    return { disclosedBytes: JSON.stringify(proposal).length }
  }

  async accept({ proposalCid }: { receiver: string; proposalCid: string }): Promise<void> {
    const proposal = this.proposals.find((p) => p.id === proposalCid)
    if (proposal === undefined) {
      return
    }
    this.proposals = this.proposals.filter((p) => p.id !== proposalCid)
    this.grants = [
      {
        id: mockId('grant'),
        title: proposal.title,
        provider: proposal.provider,
        creator: proposal.proposer,
        receiver: proposal.receiver,
        totalAmount: proposal.totalAmount,
        schedule: proposal.schedule,
        alreadyWithdrawn: 0,
        note: proposal.note,
      },
      ...this.grants,
    ]
  }

  async withdraw({
    contractCid,
    amount,
  }: {
    receiver: string
    contractCid: string
    amount: number
  }): Promise<void> {
    const grant = this.grants.find((g) => g.id === contractCid)
    if (grant === undefined) {
      return
    }
    // Mirror Contract_Claim: never claim past the vested, unclaimed balance.
    const claimable = Math.max(
      0,
      vestedAmount(grant.schedule, grant.totalAmount, now()) - grant.alreadyWithdrawn,
    )
    if (amount > claimable + 1e-9) {
      throw new Error('Claim exceeds the vested, unclaimed balance')
    }
    this.grants = this.grants.map((g) =>
      g.id === contractCid ? { ...g, alreadyWithdrawn: g.alreadyWithdrawn + amount } : g,
    )
  }

  async cancel({ contractCid }: { creator: string; contractCid: string }): Promise<void> {
    const grant = this.grants.find((g) => g.id === contractCid)
    if (grant === undefined) {
      return
    }
    this.grants = this.grants.filter((g) => g.id !== contractCid)
    const residual = Math.max(
      0,
      vestedAmount(grant.schedule, grant.totalAmount, now()) - grant.alreadyWithdrawn,
    )
    if (residual <= 0) {
      return
    }
    this.claims = [
      {
        id: mockId('claim'),
        title: grant.title,
        provider: grant.provider,
        creator: grant.creator,
        receiver: grant.receiver,
        amount: residual,
        withdrawn: 0,
        note: grant.note,
      },
      ...this.claims,
    ]
  }

  async claimResidual({
    claimCid,
    amount,
  }: {
    receiver: string
    claimCid: string
    amount: number
  }): Promise<void> {
    const claim = this.claims.find((c) => c.id === claimCid)
    if (claim === undefined) {
      return
    }
    // Mirror Claim_Withdraw: never withdraw past the residual balance.
    if (amount > claim.amount - claim.withdrawn + 1e-9) {
      throw new Error('Withdrawal exceeds the residual balance')
    }
    this.claims = this.claims
      .map((c) => (c.id === claimCid ? { ...c, withdrawn: c.withdrawn + amount } : c))
      .filter((c) => c.withdrawn < c.amount - 1e-9)
  }
}
