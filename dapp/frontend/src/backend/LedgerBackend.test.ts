import { beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeSchedule } from '@/backend/commands'
import type { Deployment } from '@/backend/config'
import { LedgerBackend } from '@/backend/LedgerBackend'
import type { DisclosedContract, LedgerCommand, WalletFns } from '@/backend/wallet'

const deployment: Deployment = {
  admin: 'instrument-admin::1',
  factoryBlob: 'YmxvYg==',
  factoryCid: 'factory-cid',
  instrumentId: 'DBT',
  pkg: 'pkg1',
  synchronizerId: 'sync::1',
}

const schedule = {
  cliff: '2026-01-01T00:00:00Z',
  curve: { kind: 'linear', start: '2026-01-01T00:00:00Z', end: '2027-01-01T00:00:00Z' },
} as const

const TOKEN = '#canton-token-forge:Canton.TokenForge.Token:Token'
const PENDING = '#vesting:Vesting:VestingProposal'
const CONTRACT = '#vesting:Vesting:VestingContract'
const CLAIM = '#vesting:Vesting:VestedClaim'

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

const tokenRow = (contractId: string, amount: string, overrides: object = {}): unknown => ({
  contractEntry: {
    JsActiveContract: {
      createdEvent: {
        contractId,
        createArgument: { admin: 'instrument-admin::1', instrumentId: 'DBT', amount, ...overrides },
        createdEventBlob: `blob-${contractId}`,
        templateId: 'tfpkg:Canton.TokenForge.Token:Token',
      },
    },
  },
})

const disclosedToken = (contractId: string): DisclosedContract => ({
  templateId: 'tfpkg:Canton.TokenForge.Token:Token',
  contractId,
  createdEventBlob: `blob-${contractId}`,
})

const CONFIG = {
  templateId: '20d54824:Canton.TokenForge.Registry:InstrumentConfig',
  contractId: '00cfg',
  createdEventBlob: 'cfg-blob',
}

// LedgerBackend owes putting whatever comes back into every write, so the fetch is replaced rather
// than stubbed. What the registry returns is registry.test.ts's rule.
vi.mock('@/backend/registry', () => ({
  fetchInstrumentConfig: async () => ({
    configCid: CONFIG.contractId,
    configTemplateId: CONFIG.templateId,
    disclosed: [CONFIG],
  }),
}))

// The harness behaves like the ledger for the one submission a grant now takes: the factory choice
// leaves a pending grant behind pledging exactly the holdings it was given. Without that, a later
// selection would happily spend a holding an outstanding grant is waiting on.
const settle = (acs: Record<string, unknown[]>, submission: Submission): void => {
  const exercise = submission.commands?.[0]?.ExerciseCommand
  if (exercise?.choice !== 'VestingFactory_CreateVesting') {
    return
  }
  const { tokenCids } = exercise.choiceArgument as { tokenCids: string[] }
  acs[PENDING] = [...(acs[PENDING] ?? []), row(`pending-for-${tokenCids[0]}`, { tokenCids })]
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
    acs = { [TOKEN]: [tokenRow('t1', '1000')] },
    declines = false,
    ledgerEnd = { offset: 42 },
    deployment: config = deployment,
  } = options
  const submissions: Submission[] = []
  const reads: Read[] = []
  const wallet: WalletFns = {
    execute: async (params) => {
      if (declines) {
        throw new Error('user rejected the request')
      }
      const submission = params as Submission
      submissions.push(submission)
      settle(acs, submission)
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

  // One submission, not two: the token-forge transfer returns the funder's leftover input as
  // change, so Accept splits and the funder never has to pre-split.
  it('funds the grant in a single submission', async () => {
    const { backend, submissions } = harness({
      acs: { [TOKEN]: [tokenRow('t1', '600'), tokenRow('t2', '900')] },
    })

    await backend.createVesting(grant)

    expect(submissions).toHaveLength(1)
    expect(submissions[0]?.commands?.[0]?.ExerciseCommand.choice).toBe(
      'VestingFactory_CreateVesting',
    )
  })

  it('names the largest holdings first, and only as many as cover the total', async () => {
    const { backend, submissions } = harness({
      acs: { [TOKEN]: [tokenRow('small', '100'), tokenRow('big', '900'), tokenRow('mid', '400')] },
    })

    await backend.createVesting(grant)

    expect(submissions[0]?.commands?.[0]?.ExerciseCommand.choiceArgument.tokenCids).toEqual([
      'big',
      'mid',
    ])
  })

  it('leaves out a holding an outstanding grant has already pledged', async () => {
    const { backend, submissions } = harness({
      acs: {
        [TOKEN]: [tokenRow('pledged', '1000'), tokenRow('free', '1000')],
        [PENDING]: [row('p1', { tokenCids: ['pledged'] })],
      },
    })

    await backend.createVesting(grant)

    expect(submissions[0]?.commands?.[0]?.ExerciseCommand.choiceArgument.tokenCids).toEqual([
      'free',
    ])
  })

  it('refuses when what is left unpledged cannot cover the grant', async () => {
    const { backend } = harness({
      acs: {
        [TOKEN]: [tokenRow('pledged', '1000'), tokenRow('free', '400')],
        [PENDING]: [row('p1', { tokenCids: ['pledged'] })],
      },
    })

    await expect(backend.createVesting(grant)).rejects.toThrow(/only 400 DBT is free/)
  })

  it('refuses a grant the funder holds nothing for', async () => {
    const { backend } = harness({ acs: {} })

    await expect(backend.createVesting(grant)).rejects.toThrow(/only 0 DBT is free/)
  })

  // A shared participant can carry another admin's DBT, and spending one would fail at the
  // transfer's own instrument check rather than here.
  it('ignores a holding of another instrument entirely', async () => {
    const { backend } = harness({
      acs: { [TOKEN]: [tokenRow('foreign', '5000', { admin: 'other::1' })] },
    })

    await expect(backend.createVesting(grant)).rejects.toThrow(/only 0 DBT is free/)
  })

  it('exercises the factory choice with the composed note and schedule, disclosing only it', async () => {
    const { backend, submissions } = harness({ acs: { [TOKEN]: [tokenRow('t1', '1000')] } })

    const result = await backend.createVesting(grant)

    expect(submissions[0]?.commands).toEqual([
      {
        ExerciseCommand: {
          templateId: 'pkg1:Vesting:VestingFactory',
          contractId: 'factory-cid',
          choice: 'VestingFactory_CreateVesting',
          choiceArgument: {
            proposer: 'funder::1',
            receiver: 'receiver::1',
            totalAmount: '1000',
            schedule: encodeSchedule(schedule),
            tokenCids: ['t1'],
            note: 'Advisor grant\nlinear',
          },
        },
      },
    ])
    // The funder is not a stakeholder of the observer-less factory, so its disclosure is the
    // deployment's rather than something read back here.
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

    await backend.createVesting(grant)

    expect(submissions[0]?.disclosedContracts?.[0]).not.toHaveProperty('synchronizerId')
  })
})

describe('LedgerBackend.balanceOf', () => {
  it('sums the unpledged holdings of this deployment’s instrument', async () => {
    const { backend } = harness({
      acs: {
        [TOKEN]: [
          tokenRow('a', '600'),
          tokenRow('b', '400'),
          tokenRow('pledged', '900'),
          tokenRow('foreign', '5000', { instrumentId: 'OTHER' }),
        ],
        [PENDING]: [row('p1', { tokenCids: ['pledged'] })],
      },
    })

    await expect(backend.balanceOf('funder::1')).resolves.toBe('1000')
  })
})

describe('LedgerBackend.tap', () => {
  // The config is nonconsuming and admin-signed, so its disclosure is the whole of what a tap needs
  // and the resolved template id has to come from that disclosure rather than from the deployment.
  it('exercises the faucet on the disclosed config, naming the connected party', async () => {
    const { backend, submissions } = harness()

    await backend.tap({ amount: '1000', party: 'funder::1' })

    expect(submissions[0]?.commands).toEqual([
      {
        ExerciseCommand: {
          templateId: CONFIG.templateId,
          contractId: '00cfg',
          choice: 'InstrumentConfig_Tap',
          choiceArgument: { user: 'funder::1', amount: '1000' },
        },
      },
    ])
    expect(submissions[0]?.disclosedContracts).toEqual(onSync([CONFIG]))
    expect(submissions[0]?.actAs).toEqual(['funder::1'])
  })
})

// Every write goes out as the party the UI is acting as, rather than left to the wallet's own
// primary account: a mismatch is then a participant rejection, not a submission signed by the
// wrong key.
describe('LedgerBackend submissions', () => {
  it('sends actAs for the acting party on every choice', async () => {
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
      ['receiver::1'],
      ['funder::1'],
      ['receiver::1'],
    ])
  })

  it('discloses the instrument config, stamped with the synchronizer, on every write that moves a holding', async () => {
    const { backend, submissions } = harness()

    await backend.withdraw({ receiver: 'receiver::1', contractCid: 'c1', amount: '10' })
    await backend.cancel({ creator: 'funder::1', contractCid: 'c1' })
    await backend.claimResidual({ receiver: 'receiver::1', claimCid: 'r1', amount: '10' })

    const stamped = onSync([CONFIG])
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
      ['pkg1:Vesting:VestingContract', 'VestingContract_Withdraw', 'c1'],
      ['pkg1:Vesting:VestingContract', 'VestingContract_Cancel', 'c1'],
      ['pkg1:Vesting:VestedClaim', 'VestedClaim_Withdraw', 'r1'],
    ])
  })

  it('carries the config into every choice argument that takes one', async () => {
    const { backend, submissions } = harness()

    await backend.withdraw({ receiver: 'receiver::1', contractCid: 'c1', amount: '10' })

    expect(submissions[0]?.commands?.[0]?.ExerciseCommand.choiceArgument).toEqual({
      withdrawAmount: '10',
      configCid: '00cfg',
    })
  })
})

// Accept is the one write disclosing contracts the submitting party cannot read for itself: the
// funder's holdings, whose blobs were kept when the funder created the pending grant.
describe('LedgerBackend.accept', () => {
  const grant = (title: string) => ({
    proposer: 'funder::1',
    receiver: 'receiver::1',
    totalAmount: '1000',
    schedule,
    title,
  })

  it('discloses the holding the grant names and nothing else it has ever stored', async () => {
    const acs: Record<string, unknown[]> = {
      [TOKEN]: [tokenRow('t1', '1500'), tokenRow('t2', '1500')],
    }
    const funder = harness({ acs })
    await funder.backend.createVesting(grant('First grant'))
    await funder.backend.createVesting(grant('Second grant'))
    const { backend, submissions } = harness({ acs })

    await backend.accept({ receiver: 'receiver::1', pendingCid: 'pending-for-t1' })

    expect(submissions[0]?.disclosedContracts).toEqual(onSync([CONFIG, disclosedToken('t1')]))
    expect(submissions[0]?.commands?.[0]?.ExerciseCommand.choice).toBe('VestingProposal_Accept')
  })

  it('refuses rather than submitting an Accept the participant would reject', async () => {
    const { backend } = harness()

    await expect(
      backend.accept({ receiver: 'receiver::1', pendingCid: 'pending-for-t1' }),
    ).rejects.toThrow(/not disclosable/)
  })

  // Two grants name the same holding whenever the second selection reads the ACS before the first
  // grant is indexed, and the funder is left unable to accept either if that is counted as an error.
  it('accepts a grant whose holding was stored by two of them', async () => {
    const acs: Record<string, unknown[]> = { [TOKEN]: [tokenRow('t1', '1500')] }
    await harness({ acs }).backend.createVesting(grant('First grant'))
    const unindexed = harness({ acs: { [TOKEN]: [tokenRow('t1', '1500')] } })
    await unindexed.backend.createVesting(grant('Second grant'))
    const { backend, submissions } = harness({ acs })

    await backend.accept({ receiver: 'receiver::1', pendingCid: 'pending-for-t1' })

    expect(submissions[0]?.disclosedContracts).toEqual(onSync([CONFIG, disclosedToken('t1')]))
  })

  it('keeps the blobs of a live grant when a later one is declined in the wallet', async () => {
    const acs: Record<string, unknown[]> = { [TOKEN]: [tokenRow('t1', '2500')] }
    const first = harness({ acs })
    await first.backend.createVesting(grant('First grant'))
    const declined = harness({ acs: { [TOKEN]: [tokenRow('t9', '1000')] }, declines: true })
    await expect(declined.backend.createVesting(grant('Second grant'))).rejects.toThrow(/rejected/)
    const { backend, submissions } = harness({ acs })

    await backend.accept({ receiver: 'receiver::1', pendingCid: 'pending-for-t1' })

    expect(submissions[0]?.disclosedContracts).toEqual(onSync([CONFIG, disclosedToken('t1')]))
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
            admin: 'instrument-admin::1',
            instrumentId: 'DBT',
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

  // A shared participant can carry another admin's grants under the same package, and rendering one
  // under this deployment's symbol would be a lie about what it holds.
  it('drops grants and claims of another instrument', async () => {
    const { backend } = harness({
      acs: {
        [CONTRACT]: [
          row('mine', {
            admin: 'instrument-admin::1',
            instrumentId: 'DBT',
            provider: 'operator::1',
            creator: 'funder::1',
            receiver: 'receiver::1',
            totalAmount: '1000',
            alreadyWithdrawn: '0',
            schedule: encodeSchedule(schedule),
            note: 'Mine',
          }),
          row('theirs', {
            admin: 'other::1',
            instrumentId: 'DBT',
            provider: 'operator::1',
            creator: 'funder::1',
            receiver: 'receiver::1',
            totalAmount: '1000',
            alreadyWithdrawn: '0',
            schedule: encodeSchedule(schedule),
            note: 'Theirs',
          }),
        ],
      },
    })

    const view = await backend.viewAs('receiver::1')

    expect(view.grants.map((one) => one.id)).toEqual(['mine'])
  })
})
