import { beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeSchedule } from '@/backend/commands'
import type { Deployment } from '@/backend/config'
import { LedgerBackend } from '@/backend/LedgerBackend'
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

const AMULET = '#splice-amulet:Splice.Amulet:Amulet'
const PENDING = '#amulet-vesting:AmuletVesting:AmuletVestingProposal'
const CONTRACT = '#amulet-vesting:AmuletVesting:AmuletVestingContract'
const CLAIM = '#amulet-vesting:AmuletVesting:AmuletVestedClaim'

type Submission = {
  actAs?: string[]
  commands?: LedgerCommand[]
  disclosedContracts?: DisclosedContract[]
}

// As much of the ACS query LedgerBackend builds as these tests read back, named once so the two
// accessors below share it rather than each casting the body to its own shape.
type PartyFilter = {
  cumulative?: { identifierFilter?: { TemplateFilter?: { value?: { templateId?: string } } } }[]
}

type AcsQuery = {
  activeAtOffset?: unknown
  filter?: { filtersByParty?: Record<string, PartyFilter> }
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

// A test passes `{}` for `extra` to make a row the split can find no DSO on.
const amuletRow = (
  contractId: string,
  initialAmount = '1000',
  extra: object = { dso: 'dso::1' },
): unknown => ({
  contractEntry: {
    JsActiveContract: {
      createdEvent: {
        contractId,
        createArgument: { amount: { initialAmount }, ...extra },
        createdEventBlob: `blob-${contractId}`,
        templateId: 'amuletpkg:Splice.Amulet:Amulet',
      },
    },
  },
})

const disclosedAmulet = (contractId: string): DisclosedContract => ({
  templateId: 'amuletpkg:Splice.Amulet:Amulet',
  contractId,
  createdEventBlob: `blob-${contractId}`,
})

// LedgerBackend owes putting whatever comes back into every write, so the fetch is replaced
// rather than stubbed. Which disclosures resolve is transferContext.test.ts's rule.
const transferContext = {
  ctx: { amuletRules: 'rules-cid', openMiningRound: 'round-2', featuredAppRight: null },
  rulesTemplateId: 'amuletpkg:Splice.AmuletRules:AmuletRules',
  disclosed: [
    {
      templateId: 'amuletpkg:Splice.AmuletRules:AmuletRules',
      contractId: 'rules-cid',
      createdEventBlob: 'rules-blob',
    },
    {
      templateId: 'amuletpkg:Splice.Round:OpenMiningRound',
      contractId: 'round-2',
      createdEventBlob: 'round-blob-2',
    },
  ],
}

vi.mock('@/backend/transferContext', () => ({
  fetchTransferContext: async () => transferContext,
}))

// createVesting is two submissions now, so the harness has to behave like the ledger under both:
// a split archives its inputs and puts the output plus any change in their place, and the factory
// choice leaves a pending grant behind pledging what it was given. Without that second half every
// later split would happily spend the Amulet an outstanding grant is waiting on.
type AmuletFields = { contractId: string; createArgument: { amount: { initialAmount: string } } }

const fields = (one: unknown): AmuletFields =>
  (one as { contractEntry: { JsActiveContract: { createdEvent: AmuletFields } } }).contractEntry
    .JsActiveContract.createdEvent

const initialAmount = (one: unknown): number =>
  Number(fields(one).createArgument.amount.initialAmount)

const settle = (acs: Record<string, unknown[]>, submission: Submission, nth: number): void => {
  const exercise = submission.commands?.[0]?.ExerciseCommand
  if (exercise?.choice === 'AmuletVestingFactory_CreateVesting') {
    const { amuletCids } = exercise.choiceArgument as { amuletCids: string[] }
    acs[PENDING] = [...(acs[PENDING] ?? []), row(`pending-for-${amuletCids[0]}`, { amuletCids })]
    return
  }
  if (exercise?.choice !== 'AmuletRules_Transfer') {
    return
  }
  const transfer = exercise.choiceArgument.transfer as {
    inputs: { value: string }[]
    outputs: { amount: string }[]
  }
  const spent = new Set(transfer.inputs.map((input) => input.value))
  const amount = Number(transfer.outputs[0].amount)
  const before = acs[AMULET] ?? []
  const consumed = before.filter((one) => spent.has(fields(one).contractId))
  const change = consumed.reduce((total: number, one) => total + initialAmount(one), 0) - amount
  acs[AMULET] = [
    ...before.filter((one) => !spent.has(fields(one).contractId)),
    amuletRow(`split-${nth}`, transfer.outputs[0].amount),
    ...(change > 0 ? [amuletRow(`change-${nth}`, String(change))] : []),
  ]
}

// The submission carries the synchronizer, so everything disclosed on one arrives stamped with it.
const onSync = <T>(contracts: T[]): (T & { synchronizerId: string })[] =>
  contracts.map((contract) => ({ ...contract, synchronizerId: 'sync::1' }))

const harness = (
  options: {
    acs?: Record<string, unknown[]>
    declines?: boolean
    deployment?: Deployment
    ledgerEnd?: unknown
  } = {},
): { backend: LedgerBackend; submissions: Submission[]; reads: Read[] } => {
  const {
    acs = { [AMULET]: [amuletRow('am1')] },
    declines = false,
    ledgerEnd = { offset: 42 },
    deployment: config = deployment,
  } = options
  const submissions: Submission[] = []
  const reads: Read[] = []
  let settled = 0
  const wallet: WalletFns = {
    execute: async (params) => {
      if (declines) {
        throw new Error('user rejected the request')
      }
      const submission = params as Submission
      submissions.push(submission)
      settle(acs, submission, ++settled)
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
  return { backend: new LedgerBackend(config, wallet), submissions, reads }
}

beforeEach(() => {
  localStorage.clear()
})

describe('LedgerBackend.createVesting', () => {
  const grant = {
    proposer: 'funder::1',
    receiver: 'receiver::1',
    totalAmount: '1000',
    schedule,
    title: 'Advisor grant',
    note: 'linear',
  }

  it('splits the amount off first, then funds the grant from what the split produced', async () => {
    const { backend, submissions } = harness({
      acs: { [AMULET]: [amuletRow('am1', '600'), amuletRow('am2', '900')] },
    })

    await backend.createVesting(grant)

    expect(submissions[0]?.commands?.[0]?.ExerciseCommand).toEqual({
      templateId: transferContext.rulesTemplateId,
      contractId: 'rules-cid',
      choice: 'AmuletRules_Transfer',
      choiceArgument: {
        transfer: {
          sender: 'funder::1',
          provider: 'funder::1',
          inputs: [
            { tag: 'InputAmulet', value: 'am1' },
            { tag: 'InputAmulet', value: 'am2' },
          ],
          outputs: [
            {
              receiver: 'funder::1',
              receiverFeeRatio: '0.0',
              amount: '1000',
              lock: null,
              meta: null,
            },
          ],
          beneficiaries: null,
        },
        context: {
          openMiningRound: 'round-2',
          issuingMiningRounds: [],
          validatorRights: [],
          featuredAppRight: null,
        },
        expectedDso: 'dso::1',
      },
    })
    expect(submissions[1]?.commands?.[0]?.ExerciseCommand.choiceArgument.amuletCids).toEqual([
      'split-1',
    ])
  })

  it('leaves out an Amulet an outstanding grant has already pledged', async () => {
    const { backend, submissions } = harness({
      acs: {
        [AMULET]: [amuletRow('pledged', '1000'), amuletRow('free', '1000')],
        [PENDING]: [row('p1', { amuletCids: ['pledged'] })],
      },
    })

    await backend.createVesting(grant)

    const transfer = submissions[0]?.commands?.[0]?.ExerciseCommand.choiceArgument.transfer as {
      inputs: { value: string }[]
    }
    expect(transfer.inputs).toEqual([{ tag: 'InputAmulet', value: 'free' }])
  })

  it('refuses when what is left unpledged cannot cover the grant', async () => {
    const { backend } = harness({
      acs: {
        [AMULET]: [amuletRow('pledged', '1000'), amuletRow('free', '400')],
        [PENDING]: [row('p1', { amuletCids: ['pledged'] })],
      },
    })

    await expect(backend.createVesting(grant)).rejects.toThrow(/only 400 AMT is free/)
  })

  it('exercises the factory choice with the composed note and schedule, disclosing only it', async () => {
    const { backend, submissions } = harness()

    const result = await backend.createVesting(grant)

    expect(submissions[1]?.commands).toEqual([
      {
        ExerciseCommand: {
          templateId: 'pkg1:AmuletVesting:AmuletVestingFactory',
          contractId: 'factory-cid',
          choice: 'AmuletVestingFactory_CreateVesting',
          choiceArgument: {
            proposer: 'funder::1',
            receiver: 'receiver::1',
            totalAmount: '1000',
            schedule: encodeSchedule(schedule),
            amuletCids: ['split-1'],
            note: 'Advisor grant\nlinear',
          },
        },
      },
    ])
    // The funder is not a stakeholder of the observer-less factory, so its disclosure is the
    // deployment's rather than something read back here.
    expect(submissions[1]?.disclosedContracts).toEqual([
      {
        templateId: 'pkg1:AmuletVesting:AmuletVestingFactory',
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

    await backend.createVesting(grant)

    expect(submissions[1]?.disclosedContracts?.[0]).not.toHaveProperty('synchronizerId')
  })

  it('refuses a grant the funder holds no Amulet for', async () => {
    const { backend } = harness({ acs: {} })

    await expect(backend.createVesting(grant)).rejects.toThrow(/only 0 AMT is free/)
  })

  // A disclosure is an opaque blob, so the split reads the DSO off an Amulet it consumes.
  it('names the DSO the funder’s own Amulets are signed by', async () => {
    const { backend, submissions } = harness({
      acs: { [AMULET]: [amuletRow('am1', '1200')] },
    })

    await backend.createVesting(grant)

    expect(submissions[0]?.commands?.[0]?.ExerciseCommand?.choiceArgument).toMatchObject({
      expectedDso: 'dso::1',
    })
  })

  it('refuses rather than sending an undefined expectedDso when no Amulet carries one', async () => {
    const { backend } = harness({ acs: { [AMULET]: [amuletRow('am1', '1200', {})] } })

    await expect(backend.createVesting(grant)).rejects.toThrow(/name no DSO party/)
  })
})

// Every write goes out as the party the UI is acting as, rather than left to the wallet's own
// primary account: a mismatch is then a participant rejection, not a submission signed by the
// wrong key.
describe('LedgerBackend submissions', () => {
  it('sends actAs for the acting party on every choice, the split included', async () => {
    const { backend, submissions } = harness()

    await backend.createVesting({
      proposer: 'funder::1',
      receiver: 'receiver::1',
      totalAmount: '1000',
      schedule,
      title: 'Advisor grant',
    })
    await backend.withdraw({ receiver: 'receiver::1', contractCid: 'c1', amount: '10' })
    await backend.cancel({ creator: 'funder::1', contractCid: 'c1' })
    await backend.claimResidual({ receiver: 'receiver::1', claimCid: 'r1', amount: '10' })

    expect(submissions.map((submission) => submission.actAs)).toEqual([
      ['funder::1'],
      ['funder::1'],
      ['receiver::1'],
      ['funder::1'],
      ['receiver::1'],
    ])
  })

  it('discloses the transfer context, stamped with the synchronizer, on every Amulet-moving write', async () => {
    const { backend, submissions } = harness()

    await backend.withdraw({ receiver: 'receiver::1', contractCid: 'c1', amount: '10' })
    await backend.cancel({ creator: 'funder::1', contractCid: 'c1' })
    await backend.claimResidual({ receiver: 'receiver::1', claimCid: 'r1', amount: '10' })

    const stamped = onSync(transferContext.disclosed)
    expect(submissions.map((submission) => submission.disclosedContracts)).toEqual([
      stamped,
      stamped,
      stamped,
    ])
  })

  it('names the template and choice each write exercises', async () => {
    const { backend, submissions } = harness()

    await backend.withdraw({ receiver: 'receiver::1', contractCid: 'c1', amount: '10.5' })
    await backend.cancel({ creator: 'funder::1', contractCid: 'c1' })
    await backend.claimResidual({ receiver: 'receiver::1', claimCid: 'r1', amount: '2' })

    expect(
      submissions.map((submission) => {
        const command = submission.commands?.[0]?.ExerciseCommand
        return [command?.templateId, command?.choice, command?.contractId]
      }),
    ).toEqual([
      ['pkg1:AmuletVesting:AmuletVestingContract', 'AmuletVestingContract_Withdraw', 'c1'],
      ['pkg1:AmuletVesting:AmuletVestingContract', 'AmuletVestingContract_Cancel', 'c1'],
      ['pkg1:AmuletVesting:AmuletVestedClaim', 'AmuletVestedClaim_Withdraw', 'r1'],
    ])
  })

  it('carries the transfer context into every choice argument that takes one', async () => {
    const { backend, submissions } = harness()

    await backend.withdraw({ receiver: 'receiver::1', contractCid: 'c1', amount: '10' })

    expect(submissions[0]?.commands?.[0]?.ExerciseCommand.choiceArgument).toEqual({
      withdrawAmount: '10',
      ctx: transferContext.ctx,
    })
  })
})

// Accept is the one write disclosing contracts the submitting party cannot read for itself: the
// funder's Amulets, whose blobs were kept when the funder created the pending grant.
describe('LedgerBackend.accept', () => {
  const grant = (title: string) => ({
    proposer: 'funder::1',
    receiver: 'receiver::1',
    totalAmount: '1000',
    schedule,
    title,
  })

  it('discloses the Amulet the grant names and nothing else it has ever stored', async () => {
    const acs: Record<string, unknown[]> = { [AMULET]: [amuletRow('am1', '3000')] }
    const funder = harness({ acs })
    await funder.backend.createVesting(grant('First grant'))
    await funder.backend.createVesting(grant('Second grant'))
    const { backend, submissions } = harness({ acs })

    await backend.accept({ receiver: 'receiver::1', pendingCid: 'pending-for-split-1' })

    expect(submissions[0]?.disclosedContracts).toEqual(
      onSync([...transferContext.disclosed, disclosedAmulet('split-1')]),
    )
    expect(submissions[0]?.commands?.[0]?.ExerciseCommand.choice).toBe(
      'AmuletVestingProposal_Accept',
    )
  })

  it('refuses rather than submitting an Accept the participant would reject', async () => {
    const { backend } = harness()

    await expect(
      backend.accept({ receiver: 'receiver::1', pendingCid: 'pending-for-split-1' }),
    ).rejects.toThrow(/not disclosable/)
  })

  it('keeps the blobs of a live grant when a later one is declined in the wallet', async () => {
    const acs: Record<string, unknown[]> = { [AMULET]: [amuletRow('am1', '2500')] }
    const first = harness({ acs })
    await first.backend.createVesting(grant('First grant'))
    const declined = harness({ acs: { [AMULET]: [amuletRow('am9')] }, declines: true })
    await expect(declined.backend.createVesting(grant('Second grant'))).rejects.toThrow(/rejected/)
    const { backend, submissions } = harness({ acs })

    await backend.accept({ receiver: 'receiver::1', pendingCid: 'pending-for-split-1' })

    expect(submissions[0]?.disclosedContracts).toEqual(
      onSync([...transferContext.disclosed, disclosedAmulet('split-1')]),
    )
  })
})

describe('LedgerBackend.viewAs', () => {
  it('reads all three templates as the connected party at one shared offset', async () => {
    const { backend, reads } = harness()

    await backend.viewAs('receiver::1')

    expect(reads[0]?.resource).toBe('/v2/state/ledger-end')
    const acsReads = reads.slice(1)
    expect(acsReads.map(filteredTemplate)).toEqual([PENDING, CONTRACT, CLAIM])
    expect(acsReads.map(filteredParty)).toEqual(['receiver::1', 'receiver::1', 'receiver::1'])
    expect(acsReads.every((read) => read.body?.activeAtOffset === 42)).toBe(true)
  })

  it('maps the rows it gets back into the domain view', async () => {
    const { backend } = harness({
      acs: {
        [CONTRACT]: [
          row('c1', {
            provider: 'operator::1',
            creator: 'funder::1',
            receiver: 'receiver::1',
            totalAmount: '1000',
            alreadyWithdrawn: '250',
            schedule: encodeSchedule(schedule),
            note: 'Advisor grant',
          }),
        ],
      },
    })

    const view = await backend.viewAs('receiver::1')

    expect(view.grants).toHaveLength(1)
    expect(view.grants[0]?.alreadyWithdrawn).toBe('250')
    expect(view.grants[0]?.creator).toBe('funder::1')
    expect(view.pendingGrants).toEqual([])
    expect(view.claims).toEqual([])
  })

  it('throws rather than querying at an undefined offset', async () => {
    const { backend } = harness({ ledgerEnd: {} })
    await expect(backend.viewAs('receiver::1')).rejects.toThrow(/did not return an offset/)
  })
})
