import { beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeSchedule, TAP_AMOUNT } from '#server/ledger/commands'
import type { Deployment } from '#server/ledger/config'
import { type DisclosureStore, LedgerBackend } from '#server/ledger/LedgerBackend'
import type { DisclosedContract, LedgerCommand, WalletFns } from '#server/ledger/wallet'

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

type PartyFilter = {
  cumulative?: { identifierFilter?: { TemplateFilter?: { value?: { templateId?: string } } } }[]
}

type AcsQuery = {
  activeAtOffset?: unknown
  eventFormat?: { filtersByParty?: Record<string, PartyFilter> }
  filter?: unknown
  verbose?: unknown
}

type Read = { requestMethod: string; resource: string; body?: AcsQuery }

const byParty = (read: Read): Record<string, PartyFilter> =>
  read.body?.eventFormat?.filtersByParty ?? {}

const filteredTemplate = (read: Read): string | undefined =>
  Object.values(byParty(read))[0]?.cumulative?.[0]?.identifierFilter?.TemplateFilter?.value
    ?.templateId

const filteredParty = (read: Read): string | undefined => Object.keys(byParty(read))[0]

const row = (contractId: string, arg: Record<string, unknown>): unknown => ({
  contractEntry: { JsActiveContract: { createdEvent: { contractId, createArgument: arg } } },
})

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

vi.mock('#server/ledger/transferContext', () => ({
  fetchTransferContext: async () => transferContext,
}))

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
      if (read.body?.filter !== undefined || read.body?.verbose !== undefined) {
        throw new Error('DEPRECATED_API_DISABLED')
      }
      if (read.resource === '/v2/state/ledger-end') {
        return ledgerEnd
      }
      return acs[filteredTemplate(read) ?? ''] ?? []
    },
  }
  return { backend: new LedgerBackend(config, wallet, disclosures), submissions, reads }
}

const memoryDisclosures = (): DisclosureStore => {
  const stored = new Map<string, DisclosedContract>()
  return {
    drop: async (contractId) => {
      stored.delete(contractId)
    },
    get: async (contractId) => stored.get(contractId),
    put: async (disclosed) => {
      stored.set(disclosed.contractId, disclosed)
    },
  }
}

let disclosures: DisclosureStore = memoryDisclosures()

beforeEach(() => {
  disclosures = memoryDisclosures()
})

describe('LedgerBackend.createVesting', () => {
  const grant = {
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

    await backend.createVesting('funder::1', grant)

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

    await backend.createVesting('funder::1', grant)

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

    await expect(backend.createVesting('funder::1', grant)).rejects.toThrow(/only 400 AMT is free/)
  })

  it('builds the factory choice and discloses the factory the deployment carries', async () => {
    const { backend, submissions } = harness()

    await backend.createVesting('funder::1', grant)

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
    expect(submissions[1]?.disclosedContracts).toEqual([
      {
        templateId: 'pkg1:AmuletVesting:AmuletVestingFactory',
        contractId: 'factory-cid',
        createdEventBlob: 'YmxvYg==',
        synchronizerId: 'sync::1',
      },
    ])
  })

  it('funds a second grant sent at once from what the first one left free', async () => {
    const { backend, submissions } = harness({ acs: { [AMULET]: [amuletRow('am1', '2500')] } })

    await Promise.all([
      backend.createVesting('funder::1', grant),
      backend.createVesting('funder::1', grant),
    ])

    const splits = submissions.flatMap((one) => {
      const exercise = one.commands?.[0]?.ExerciseCommand
      return exercise?.choice === 'AmuletRules_Transfer'
        ? [(exercise.choiceArgument.transfer as { inputs: unknown[] }).inputs]
        : []
    })
    expect(splits).toEqual([
      [{ tag: 'InputAmulet', value: 'am1' }],
      [{ tag: 'InputAmulet', value: 'change-1' }],
    ])
  })

  it('stores the escrow blob before it submits the proposal', async () => {
    let submitted = () => -1
    let atPut: number | undefined
    disclosures = {
      ...memoryDisclosures(),
      put: async () => {
        atPut = submitted()
      },
    }
    const { backend, submissions } = harness()
    submitted = () => submissions.length

    await backend.createVesting('funder::1', grant)

    expect(atPut).toBe(1)
  })

  it('refuses a grant the funder holds no Amulet for', async () => {
    const { backend } = harness({ acs: {} })

    await expect(backend.createVesting('funder::1', grant)).rejects.toThrow(/only 0 AMT is free/)
  })

  it('reads the DSO off a funder Amulet, since a disclosure carries no payload', async () => {
    const { backend, submissions } = harness({
      acs: { [AMULET]: [amuletRow('am1', '1200')] },
    })

    await backend.createVesting('funder::1', grant)

    expect(submissions[0]?.commands?.[0]?.ExerciseCommand?.choiceArgument).toMatchObject({
      expectedDso: 'dso::1',
    })
  })

  it('refuses when no Amulet carries a DSO to name as expectedDso', async () => {
    const { backend } = harness({ acs: { [AMULET]: [amuletRow('am1', '1200', {})] } })

    await expect(backend.createVesting('funder::1', grant)).rejects.toThrow(/name no DSO party/)
  })
})

describe('LedgerBackend submissions', () => {
  it('sends actAs for the acting party on every choice, the split included', async () => {
    const { backend, submissions } = harness()

    await backend.createVesting('funder::1', {
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

  it('discloses the transfer context on every Amulet-moving write, synchronizer set', async () => {
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

  it('taps AmuletRules for the connected party, on the same two disclosures', async () => {
    const { backend, submissions } = harness()

    await backend.tap('funder::1')

    const command = submissions[0]?.commands?.[0]?.ExerciseCommand
    expect([command?.templateId, command?.choice, command?.contractId]).toEqual([
      transferContext.rulesTemplateId,
      'AmuletRules_DevNet_Tap',
      transferContext.ctx.amuletRules,
    ])
    expect(command?.choiceArgument).toEqual({
      receiver: 'funder::1',
      amount: TAP_AMOUNT,
      openRound: transferContext.ctx.openMiningRound,
    })
    expect(submissions[0]?.disclosedContracts).toEqual(onSync(transferContext.disclosed))
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

describe('LedgerBackend.accept', () => {
  const grant = (title: string) => ({
    receiver: 'receiver::1',
    totalAmount: '1000',
    schedule,
    title,
  })

  it('discloses the Amulet the grant names and nothing else it has ever stored', async () => {
    const acs: Record<string, unknown[]> = { [AMULET]: [amuletRow('am1', '3000')] }
    const funder = harness({ acs })
    await funder.backend.createVesting('funder::1', grant('First grant'))
    await funder.backend.createVesting('funder::1', grant('Second grant'))
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

  it('keeps the blobs of a live grant when a later one is rejected by the ledger', async () => {
    const acs: Record<string, unknown[]> = { [AMULET]: [amuletRow('am1', '2500')] }
    const first = harness({ acs })
    await first.backend.createVesting('funder::1', grant('First grant'))
    const declined = harness({ acs: { [AMULET]: [amuletRow('am9')] }, declines: true })
    await expect(
      declined.backend.createVesting('funder::1', grant('Second grant')),
    ).rejects.toThrow(/rejected/)
    const { backend, submissions } = harness({ acs })

    await backend.accept({ receiver: 'receiver::1', pendingCid: 'pending-for-split-1' })

    expect(submissions[0]?.disclosedContracts).toEqual(
      onSync([...transferContext.disclosed, disclosedAmulet('split-1')]),
    )
  })
})

describe('LedgerBackend.claimHistory', () => {
  it('reads past the first page of the update stream', async () => {
    const begins: unknown[] = []
    const page = Array.from({ length: 1000 }, (_, i) => ({
      update: { Transaction: { value: { offset: i + 1 } } },
    }))
    const wallet: WalletFns = {
      execute: async () => ({}),
      ledgerApi: async (params) => {
        if (params.resource === '/v2/state/ledger-end') return { offset: 5000 }
        const { beginExclusive } = params.body as { beginExclusive: unknown }
        begins.push(beginExclusive)
        return beginExclusive === 0 ? page : []
      },
    }

    await new LedgerBackend(deployment, wallet, disclosures).claimHistory('receiver::1', 'g1')

    expect(begins).toEqual([0, 1000])
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
