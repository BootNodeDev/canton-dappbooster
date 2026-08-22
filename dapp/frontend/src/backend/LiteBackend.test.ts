import { describe, expect, it } from 'vitest'
import { encodeSchedule } from '@/backend/commands'
import type { Deployment } from '@/backend/config'
import { LiteBackend } from '@/backend/LiteBackend'
import type { DisclosedContract, LedgerCommand, WalletFns } from '@/backend/wallet'

const deployment: Deployment = {
  pkg: 'pkg1',
  factoryCid: 'factory-cid',
  factoryBlob: 'YmxvYg==',
  synchronizerId: 'sync::1',
}

const schedule = {
  cliff: '2026-01-01T00:00:00Z',
  curve: { kind: 'linear', start: '2026-01-01T00:00:00Z', end: '2027-01-01T00:00:00Z' },
} as const

type Submission = {
  actAs?: string[]
  commands?: LedgerCommand[]
  disclosedContracts?: DisclosedContract[]
}

// As much of the ACS query LiteBackend builds as these tests read back, named once so the two
// accessors below share it rather than each casting the body to its own shape.
type PartyFilter = {
  cumulative?: { identifierFilter?: { TemplateFilter?: { value?: { templateId?: string } } } }[]
}

type AcsQuery = {
  filter?: { filtersByParty?: Record<string, PartyFilter> }
  activeAtOffset?: unknown
}

type Read = { requestMethod: string; resource: string; body?: AcsQuery }

const byParty = (read: Read): Record<string, PartyFilter> => read.body?.filter?.filtersByParty ?? {}

// The template a read filters on, which is what a party-scoped ACS query is keyed by here.
const filteredTemplate = (read: Read): string | undefined =>
  Object.values(byParty(read))[0]?.cumulative?.[0]?.identifierFilter?.TemplateFilter?.value
    ?.templateId

const filteredParty = (read: Read): string | undefined => Object.keys(byParty(read))[0]

const row = (contractId: string, arg: Record<string, unknown>): unknown => ({
  contractEntry: { JsActiveContract: { createdEvent: { contractId, createArgument: arg } } },
})

const harness = (
  options: { acs?: Record<string, unknown[]>; ledgerEnd?: unknown; deployment?: Deployment } = {},
): { backend: LiteBackend; submissions: Submission[]; reads: Read[] } => {
  const { acs = {}, ledgerEnd = { offset: 42 }, deployment: config = deployment } = options
  const submissions: Submission[] = []
  const reads: Read[] = []
  const wallet: WalletFns = {
    execute: async (params) => {
      submissions.push(params as Submission)
      return {}
    },
    ledgerApi: async (params) => {
      const read = params as Read
      reads.push(read)
      if (read.resource === '/v2/state/ledger-end') {
        return ledgerEnd
      }
      return acs[filteredTemplate(read) ?? ''] ?? []
    },
  }
  return { backend: new LiteBackend(config, wallet), submissions, reads }
}

describe('LiteBackend.createVesting', () => {
  it('discloses the factory from the deployment config, not from a ledger read', async () => {
    const { backend, submissions, reads } = harness()

    const result = await backend.createVesting({
      proposer: 'funder::1',
      receiver: 'receiver::1',
      totalAmount: '1000',
      schedule,
      title: 'Advisor grant',
      note: 'linear',
    })

    // The funder is not a stakeholder of the observer-less factory, so no read may stand between
    // the config and the submission.
    expect(reads).toEqual([])
    expect(submissions[0]?.disclosedContracts).toEqual([
      {
        templateId: 'pkg1:Vesting:VestingFactory',
        contractId: 'factory-cid',
        createdEventBlob: 'YmxvYg==',
        synchronizerId: 'sync::1',
      },
    ])
    expect(result.disclosedBytes).toBe(deployment.factoryBlob.length)
  })

  it('omits the synchronizer id when the config carries none', async () => {
    const { synchronizerId, ...rest } = deployment
    const { backend, submissions } = harness({ deployment: rest })

    await backend.createVesting({
      proposer: 'funder::1',
      receiver: 'receiver::1',
      totalAmount: '1000',
      schedule,
      title: 'Advisor grant',
    })

    expect(submissions[0]?.disclosedContracts?.[0]).not.toHaveProperty('synchronizerId')
  })

  it('exercises the factory choice with the composed note and the encoded schedule', async () => {
    const { backend, submissions } = harness()

    await backend.createVesting({
      proposer: 'funder::1',
      receiver: 'receiver::1',
      totalAmount: '1000',
      schedule,
      title: 'Advisor grant',
      note: 'linear',
    })

    expect(submissions[0]?.commands).toEqual([
      {
        ExerciseCommand: {
          templateId: 'pkg1:Vesting:VestingFactory',
          contractId: 'factory-cid',
          choice: 'Factory_CreateVesting',
          choiceArgument: {
            proposer: 'funder::1',
            beneficiary: 'receiver::1',
            total: '1000',
            schedule: encodeSchedule(schedule),
            note: 'Advisor grant\nlinear',
          },
        },
      },
    ])
  })
})

// Every write goes out as the party the UI is acting as, rather than left to the wallet's own
// primary account: a mismatch is then a participant rejection, not a submission signed by the
// wrong key.
describe('LiteBackend submissions', () => {
  it('sends actAs for the acting party on every choice', async () => {
    const { backend, submissions } = harness()

    await backend.createVesting({
      proposer: 'funder::1',
      receiver: 'receiver::1',
      totalAmount: '1000',
      schedule,
      title: 'Advisor grant',
    })
    await backend.accept({ receiver: 'receiver::1', proposalCid: 'p1' })
    await backend.withdraw({ receiver: 'receiver::1', contractCid: 'c1', amount: '10' })
    await backend.cancel({ creator: 'funder::1', contractCid: 'c1' })
    await backend.claimResidual({ receiver: 'receiver::1', claimCid: 'r1', amount: '10' })

    expect(submissions.map((submission) => submission.actAs)).toEqual([
      ['funder::1'],
      ['receiver::1'],
      ['receiver::1'],
      ['funder::1'],
      ['receiver::1'],
    ])
  })

  it('discloses nothing on the choices whose contract the party already sees', async () => {
    const { backend, submissions } = harness()

    await backend.accept({ receiver: 'receiver::1', proposalCid: 'p1' })
    await backend.withdraw({ receiver: 'receiver::1', contractCid: 'c1', amount: '10' })
    await backend.cancel({ creator: 'funder::1', contractCid: 'c1' })
    await backend.claimResidual({ receiver: 'receiver::1', claimCid: 'r1', amount: '10' })

    expect(submissions.every((submission) => submission.disclosedContracts === undefined)).toBe(
      true,
    )
  })

  it('names the template and choice each write exercises', async () => {
    const { backend, submissions } = harness()

    await backend.accept({ receiver: 'receiver::1', proposalCid: 'p1' })
    await backend.withdraw({ receiver: 'receiver::1', contractCid: 'c1', amount: '10.5' })
    await backend.cancel({ creator: 'funder::1', contractCid: 'c1' })
    await backend.claimResidual({ receiver: 'receiver::1', claimCid: 'r1', amount: '2' })

    expect(
      submissions.map((submission) => {
        const command = submission.commands?.[0]?.ExerciseCommand
        return [command?.templateId, command?.choice, command?.contractId]
      }),
    ).toEqual([
      ['pkg1:Vesting:VestingProposal', 'Proposal_Accept', 'p1'],
      ['pkg1:Vesting:VestingContract', 'Contract_Claim', 'c1'],
      ['pkg1:Vesting:VestingContract', 'Contract_Cancel', 'c1'],
      ['pkg1:Vesting:VestedClaim', 'Claim_Withdraw', 'r1'],
    ])
  })
})

describe('LiteBackend.viewAs', () => {
  it('reads all three templates as the connected party at one shared offset', async () => {
    const { backend, reads } = harness()

    await backend.viewAs('receiver::1')

    expect(reads[0]?.resource).toBe('/v2/state/ledger-end')
    const acsReads = reads.slice(1)
    expect(acsReads.map(filteredTemplate)).toEqual([
      'pkg1:Vesting:VestingProposal',
      'pkg1:Vesting:VestingContract',
      'pkg1:Vesting:VestedClaim',
    ])
    expect(acsReads.map(filteredParty)).toEqual(['receiver::1', 'receiver::1', 'receiver::1'])
    expect(acsReads.every((read) => read.body?.activeAtOffset === 42)).toBe(true)
  })

  it('maps the rows it gets back into the domain view', async () => {
    const { backend } = harness({
      acs: {
        'pkg1:Vesting:VestingContract': [
          row('c1', {
            provider: 'operator::1',
            proposer: 'funder::1',
            beneficiary: 'receiver::1',
            total: '1000',
            claimed: '250',
            schedule: encodeSchedule(schedule),
            note: 'Advisor grant',
          }),
        ],
      },
    })

    const view = await backend.viewAs('receiver::1')

    expect(view.grants).toHaveLength(1)
    expect(view.grants[0]?.alreadyWithdrawn).toBe('250')
    expect(view.proposals).toEqual([])
    expect(view.claims).toEqual([])
  })

  it('throws rather than querying at an undefined offset', async () => {
    const { backend } = harness({ ledgerEnd: {} })
    await expect(backend.viewAs('receiver::1')).rejects.toThrow(/did not return an offset/)
  })
})
