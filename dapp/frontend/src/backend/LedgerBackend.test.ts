import { beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeSchedule } from '@/backend/commands'
import type { Deployment } from '@/backend/config'
import { LedgerBackend } from '@/backend/LedgerBackend'
import type { DisclosedContract, LedgerCommand, WalletFns } from '@/backend/wallet'
import { addAmounts, isZero, subtractAmounts } from '@/utils/amount'

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
  synchronizerId?: string
}

// As much of the ACS query LedgerBackend builds as these tests read back, named once so the two
// accessors below share it rather than each casting the body to its own shape.
type PartyFilter = {
  cumulative?: {
    identifierFilter?: {
      TemplateFilter?: { value?: { includeCreatedEventBlob?: boolean; templateId?: string } }
    }
  }[]
}

type AcsQuery = {
  activeAtOffset?: unknown
  filter?: { filtersByParty?: Record<string, PartyFilter> }
}

type Read = {
  requestMethod: string
  resource: string
  body?: AcsQuery
}

const byParty = (read: Read): Record<string, PartyFilter> => read.body?.filter?.filtersByParty ?? {}

// The template a read filters on, which is what a party-scoped ACS query is keyed by here.
const filteredTemplate = (read: Read): string | undefined =>
  Object.values(byParty(read))[0]?.cumulative?.[0]?.identifierFilter?.TemplateFilter?.value
    ?.templateId

const filteredParty = (read: Read): string | undefined => Object.keys(byParty(read))[0]

const readsBlobs = (read: Read): boolean =>
  byParty(read)[filteredParty(read) ?? '']?.cumulative?.[0]?.identifierFilter?.TemplateFilter?.value
    ?.includeCreatedEventBlob === true

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

// An outstanding grant of this deployment's instrument, reserving the named holding.
const reserving = (tokenCid: string): unknown =>
  row(`pending-${tokenCid}`, {
    admin: 'instrument-admin::1',
    instrumentId: 'DBT',
    provider: 'operator::1',
    proposer: 'funder::1',
    receiver: 'receiver::1',
    totalAmount: '1000',
    tokenCid,
    schedule: encodeSchedule(schedule),
    note: 'Advisor grant',
  })

// What the funder kept for the receiver, read the way the backend keys it: `accept` picks one blob
// out of this, so only a direct look says whether the store itself is growing.
const storedTokens = (): DisclosedContract[] =>
  JSON.parse(localStorage.getItem('vesting.tokenDisclosures') ?? '[]')

// The other half of what a grant leaves behind: how many blob-bearing reads this browser has spent
// looking for a holding it never found.
const readMisses = (): Record<string, number> =>
  JSON.parse(localStorage.getItem('vesting.tokenReadMisses') ?? '{}')

const CONFIG = {
  templateId: '20d54824:Canton.TokenForge.Registry:InstrumentConfig',
  contractId: '00cfg',
  createdEventBlob: 'cfg-blob',
}

// LedgerBackend owes putting whatever comes back into every write, so the fetch is replaced rather
// than stubbed. What the registry returns is registry.test.ts's rule. Hoisted, because a vi.mock
// factory is lifted above every other statement in the file.
const registryAnswer = vi.hoisted(() => ({ synchronizerId: undefined as string | undefined }))

vi.mock('@/backend/registry', () => ({
  fetchInstrumentConfig: async () => ({
    configCid: CONFIG.contractId,
    configTemplateId: CONFIG.templateId,
    disclosed: [CONFIG],
    synchronizerId: registryAnswer.synchronizerId,
  }),
}))

type Created = {
  contractId?: string
  createArgument?: { admin?: string; amount?: string; instrumentId?: string }
}

const createdEvent = (contract: unknown): Created =>
  (contract as { contractEntry?: { JsActiveContract?: { createdEvent?: Created } } }).contractEntry
    ?.JsActiveContract?.createdEvent ?? {}

const cidOf = (contract: unknown): string => createdEvent(contract).contractId ?? ''

// The harness behaves like the ledger for the one submission a grant takes: the factory splits the
// holdings it is given, so those are consumed and replaced by one holding of exactly the grant plus
// the funder's change, and the pending grant names the first of the two. Without that, a later
// selection would happily spend the holding an outstanding grant is waiting on, and no holding
// would exist for the funder to disclose to the receiver.
const settle = (acs: Record<string, unknown[]>, submission: Submission): void => {
  const exercise = submission.commands?.[0]?.ExerciseCommand
  if (exercise?.choice !== 'VestingFactory_CreateVesting') {
    return
  }
  const { note, receiver, tokenCids, totalAmount } = exercise.choiceArgument as {
    note: string | null
    receiver: string
    tokenCids: string[]
    totalAmount: string
  }
  const held = acs[TOKEN] ?? []
  const spent = held.filter((contract) => tokenCids.includes(cidOf(contract)))
  const change = subtractAmounts(
    addAmounts(...spent.map((contract) => createdEvent(contract).createArgument?.amount ?? '0')),
    totalAmount,
  )
  // The choice takes no instrument of its own: what comes out is the instrument of what went in, so
  // a test that funds from another admin's holdings gets a proposal of that admin here too.
  const { admin, instrumentId } = createdEvent(spent[0]).createArgument ?? {}
  const instrument = { admin, instrumentId }
  const funding = tokenRow(`funding-${tokenCids[0]}`, totalAmount, instrument)
  const returned = isZero(change) ? [] : [tokenRow(`change-${tokenCids[0]}`, change, instrument)]
  const pending = row(`pending-for-${tokenCids[0]}`, {
    ...instrument,
    provider: 'operator::1',
    proposer: submission.actAs?.[0],
    receiver,
    totalAmount,
    tokenCid: cidOf(funding),
    note,
  })
  acs[TOKEN] = [
    ...held.filter((contract) => !tokenCids.includes(cidOf(contract))),
    funding,
    ...returned,
  ]
  acs[PENDING] = [...(acs[PENDING] ?? []), pending]
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
    readsFailAfterSubmit?: boolean
    readsFailOnBlobs?: boolean
  } = {},
): { backend: LedgerBackend; submissions: Submission[]; reads: Read[] } => {
  const {
    acs = { [TOKEN]: [tokenRow('t1', '1000')] },
    declines = false,
    ledgerEnd = { offset: 42 },
    deployment: config = deployment,
    readsFailAfterSubmit = false,
    readsFailOnBlobs = false,
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
      // The wallet answers with the transaction's own ids, none of which name a contract it
      // created.
      return { tx: { payload: { updateId: `update-${submissions.length}` } } }
    },
    ledgerApi: async (params) => {
      const read = params as Read
      reads.push(read)
      if (readsFailAfterSubmit && submissions.length > 0) {
        throw new Error('the participant is not answering')
      }
      if (readsFailOnBlobs && read.body?.filter !== undefined && readsBlobs(read)) {
        throw new Error('the participant is not answering')
      }
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
  registryAnswer.synchronizerId = undefined
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

  // One submission, not two: the factory splits the funder's inputs itself, so the funder never has
  // to pre-split and the change comes back in the same transaction.
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

  it('leaves out the holding an outstanding grant has already reserved', async () => {
    const { backend, submissions } = harness({
      acs: {
        [TOKEN]: [tokenRow('pledged', '1000'), tokenRow('free', '1000')],
        [PENDING]: [row('p1', { tokenCid: 'pledged' })],
      },
    })

    await backend.createVesting(grant)

    expect(submissions[0]?.commands?.[0]?.ExerciseCommand.choiceArgument.tokenCids).toEqual([
      'free',
    ])
  })

  it('refuses when what is left unreserved cannot cover the grant', async () => {
    const { backend } = harness({
      acs: {
        [TOKEN]: [tokenRow('pledged', '1000'), tokenRow('free', '400')],
        [PENDING]: [row('p1', { tokenCid: 'pledged' })],
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

  it('exercises the factory choice with the composed note, schedule and config', async () => {
    const { backend, submissions } = harness({ acs: { [TOKEN]: [tokenRow('t1', '1000')] } })

    await backend.createVesting(grant)

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
            configCid: '00cfg',
            note: 'Advisor grant\nlinear',
          },
        },
      },
    ])
    // The config because the split runs against it, the factory because the funder is not a
    // stakeholder of the observer-less factory and so cannot read it. The inputs are the funder's
    // own, so they need no disclosure.
    expect(submissions[0]?.disclosedContracts).toEqual(
      onSync([
        CONFIG,
        {
          templateId: 'pkg1:Vesting:VestingFactory',
          contractId: 'factory-cid',
          createdEventBlob: 'YmxvYg==',
        },
      ]),
    )
  })

  it('omits the synchronizer id when neither the deployment nor the registry names one', async () => {
    const { synchronizerId, ...rest } = deployment
    const { backend, submissions } = harness({ deployment: rest })

    await backend.createVesting(grant)

    expect(submissions[0]?.disclosedContracts?.[0]).not.toHaveProperty('synchronizerId')
    expect(submissions[0]).not.toHaveProperty('synchronizerId')
  })

  // The config the registry discloses is rebuilt without the synchronizer it arrived stamped with,
  // so what the registry knows would be thrown away rather than used where the deployment is silent.
  it('falls back to the synchronizer the registry stamped when the deployment names none', async () => {
    const { synchronizerId, ...rest } = deployment
    registryAnswer.synchronizerId = 'sync::1'
    const { backend, submissions } = harness({ deployment: rest })

    await backend.createVesting(grant)

    expect(submissions[0]?.synchronizerId).toBe('sync::1')
    expect(submissions[0]?.disclosedContracts?.[0]).toHaveProperty('synchronizerId', 'sync::1')
  })

  // One submission names one synchronizer and the two contracts it needs come from two sources, so
  // a disagreement has to be said here: sent, it is a rejection that names neither.
  it('refuses to submit when the registry and the deployment disagree on the synchronizer', async () => {
    registryAnswer.synchronizerId = 'sync::2'
    const { backend, submissions } = harness()

    await expect(backend.createVesting(grant)).rejects.toThrow(/sync::2.*sync::1/)
    expect(submissions).toHaveLength(0)
  })

  // The acceptance criterion this issue exists for: the funder keeps everything the grant did not
  // take, rather than the whole holding it was funded from.
  it('leaves the funder everything the grant did not reserve', async () => {
    const { backend } = harness({ acs: { [TOKEN]: [tokenRow('t1', '1500')] } })

    await backend.createVesting(grant)

    await expect(backend.balanceOf('funder::1')).resolves.toBe('500')
  })

  // The holding the receiver will have to disclose is created by this very submission, so the read
  // that carries its blob runs after the write and not with the selection before it.
  it('reads the split holding back only once the grant is on the ledger', async () => {
    const { backend, reads } = harness({ acs: { [TOKEN]: [tokenRow('t1', '1500')] } })

    await backend.createVesting(grant)

    const withBlobs = reads.filter(
      (read) =>
        read.body?.filter !== undefined && readsBlobs(read) && filteredTemplate(read) === TOKEN,
    )
    expect(withBlobs).toHaveLength(1)
  })

  // The grant is on the ledger by then, so reporting a failure would invite the funder to make a
  // second one; the Accept is what says the blob is missing.
  it('reports a grant whose funding holding could not be read back as created', async () => {
    const { backend } = harness({
      acs: { [TOKEN]: [tokenRow('t1', '1500')] },
      readsFailAfterSubmit: true,
    })

    await expect(backend.createVesting(grant)).resolves.toBeUndefined()
  })
})

describe('LedgerBackend.balanceOf', () => {
  it('sums the unreserved holdings of this deployment’s instrument', async () => {
    const { backend } = harness({
      acs: {
        [TOKEN]: [
          tokenRow('a', '600'),
          tokenRow('b', '400'),
          tokenRow('reserved', '900'),
          tokenRow('foreign', '5000', { instrumentId: 'OTHER' }),
        ],
        [PENDING]: [row('p1', { tokenCid: 'reserved' })],
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
    expect(submissions.map((submission) => submission.synchronizerId)).toEqual([
      'sync::1',
      'sync::1',
      'sync::1',
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

    // The split output, never the input it came out of: that one is archived, and re-disclosing it
    // would only fail the transfer's own fetch.
    expect(submissions[0]?.disclosedContracts).toEqual(
      onSync([CONFIG, disclosedToken('funding-t1')]),
    )
    expect(submissions[0]?.commands?.[0]?.ExerciseCommand.choice).toBe('VestingProposal_Accept')
  })

  // A blob the funder never handed over and a grant that is simply gone are two different things,
  // and telling a stale dashboard about the blob store sends the receiver looking in the wrong
  // place entirely.
  it('refuses an Accept whose blob this browser never kept', async () => {
    const acs: Record<string, unknown[]> = { [TOKEN]: [tokenRow('t1', '1500')] }
    const funder = harness({ acs })
    await funder.backend.createVesting(grant('First grant'))
    localStorage.clear()
    const { backend, submissions } = harness({ acs })

    await expect(
      backend.accept({ receiver: 'receiver::1', pendingCid: 'pending-for-t1' }),
    ).rejects.toThrow(/not disclosable/)
    expect(submissions).toHaveLength(0)
  })

  it('refuses an Accept for a grant no longer in the receiver’s view', async () => {
    const { backend, submissions } = harness()

    await expect(
      backend.accept({ receiver: 'receiver::1', pendingCid: 'pending-for-t1' }),
    ).rejects.toThrow(/no longer outstanding/)
    expect(submissions).toHaveLength(0)
  })

  // Why every outstanding grant is reconciled and not only the one just made: a read that failed
  // once would otherwise leave a grant nobody can ever accept.
  it('picks up a blob a failed read left behind when the next grant is created', async () => {
    const acs: Record<string, unknown[]> = {
      [TOKEN]: [tokenRow('t1', '1500'), tokenRow('t2', '1500')],
    }
    const flaky = harness({ acs, readsFailAfterSubmit: true })
    await flaky.backend.createVesting(grant('First grant'))
    const funder = harness({ acs })
    await funder.backend.createVesting(grant('Second grant'))
    const { backend, submissions } = harness({ acs })

    await backend.accept({ receiver: 'receiver::1', pendingCid: 'pending-for-t1' })

    expect(submissions[0]?.disclosedContracts).toEqual(
      onSync([CONFIG, disclosedToken('funding-t1')]),
    )
  })

  // The funder may never create a second grant, so the next grant cannot be the only repair: their
  // own dashboard is where an unacceptable grant would otherwise sit unnoticed forever.
  it('picks up a blob a failed read left behind on the funder’s next view', async () => {
    const acs: Record<string, unknown[]> = { [TOKEN]: [tokenRow('t1', '1500')] }
    const flaky = harness({ acs, readsFailAfterSubmit: true })
    await flaky.backend.createVesting(grant('First grant'))
    const funder = harness({ acs })
    await funder.backend.viewAs('funder::1')
    const { backend, submissions } = harness({ acs })

    await backend.accept({ receiver: 'receiver::1', pendingCid: 'pending-for-t1' })

    expect(submissions[0]?.disclosedContracts).toEqual(
      onSync([CONFIG, disclosedToken('funding-t1')]),
    )
  })

  it('keeps the blob of a live grant when a later one is declined in the wallet', async () => {
    const acs: Record<string, unknown[]> = { [TOKEN]: [tokenRow('t1', '2500')] }
    const first = harness({ acs })
    await first.backend.createVesting(grant('First grant'))
    const declined = harness({ acs: { [TOKEN]: [tokenRow('t9', '1000')] }, declines: true })
    await expect(declined.backend.createVesting(grant('Second grant'))).rejects.toThrow(/rejected/)
    const { backend, submissions } = harness({ acs })

    await backend.accept({ receiver: 'receiver::1', pendingCid: 'pending-for-t1' })

    expect(submissions[0]?.disclosedContracts).toEqual(
      onSync([CONFIG, disclosedToken('funding-t1')]),
    )
  })

  // A miss counted before the blob was finally found used to outlive the grant entirely: `accept`
  // dropped the blob and left the count behind for a contract id that can never come back.
  it('drops a stale miss count when the grant is finally accepted', async () => {
    const missed = harness({
      acs: { [TOKEN]: [tokenRow('unrelated', '500')], [PENDING]: [reserving('funding-t1')] },
    })
    await missed.backend.viewAs('funder::1')
    expect(readMisses()['funding-t1']).toBe(1)
    const found = harness({
      acs: { [TOKEN]: [tokenRow('funding-t1', '1000')], [PENDING]: [reserving('funding-t1')] },
    })
    await found.backend.viewAs('funder::1')

    await found.backend.accept({ receiver: 'receiver::1', pendingCid: 'pending-funding-t1' })

    expect(storedTokens()).toEqual([])
    expect(readMisses()).toEqual({})
  })
})

// Both exits are bodyless and archive the proposal on the controller's own authority, so the
// interesting part is not the ledger but what stops being kept in this browser afterwards.
describe('LedgerBackend.cancelProposal and rejectProposal', () => {
  const grant = (title = 'Advisor grant') => ({
    proposer: 'funder::1',
    receiver: 'receiver::1',
    totalAmount: '1000',
    schedule,
    title,
  })

  it('cancels as the funder, disclosing nothing', async () => {
    const acs: Record<string, unknown[]> = { [TOKEN]: [tokenRow('t1', '1500')] }
    const { backend, submissions } = harness({ acs })
    await backend.createVesting(grant())

    await backend.cancelProposal({ proposer: 'funder::1', pendingCid: 'pending-for-t1' })

    const submission = submissions.at(-1)
    expect(submission?.commands?.[0]?.ExerciseCommand.choice).toBe('VestingProposal_Cancel')
    expect(submission?.actAs).toEqual(['funder::1'])
    // Empty, not the config: nothing is disclosed, which is also what proves the registry was
    // never asked.
    expect(submission?.disclosedContracts).toEqual([])
    // The one write that discloses nothing, so the only one where a synchronizer stamped on the
    // disclosures alone would leave the wallet to pick its own.
    expect(submission?.synchronizerId).toBe('sync::1')
  })

  it('rejects as the receiver, disclosing nothing', async () => {
    const acs: Record<string, unknown[]> = { [TOKEN]: [tokenRow('t1', '1500')] }
    const funder = harness({ acs })
    await funder.backend.createVesting(grant())
    const { backend, submissions } = harness({ acs })

    await backend.rejectProposal({ receiver: 'receiver::1', pendingCid: 'pending-for-t1' })

    expect(submissions[0]?.commands?.[0]?.ExerciseCommand.choice).toBe('VestingProposal_Reject')
    expect(submissions[0]?.actAs).toEqual(['receiver::1'])
    expect(submissions[0]?.disclosedContracts).toEqual([])
  })

  // The read is for the prune, never for a guard: the receiver is not who the blob belongs to, so a
  // participant that will not answer must cost them a stale entry rather than the decline itself.
  it('declines even when the proposal cannot be read', async () => {
    const submissions: Submission[] = []
    const backend = new LedgerBackend(deployment, {
      execute: async (params) => {
        submissions.push(params as Submission)
        return {}
      },
      ledgerApi: async () => {
        throw new Error('the participant is not answering')
      },
    })

    await backend.rejectProposal({ receiver: 'receiver::1', pendingCid: 'pending-for-t1' })

    expect(submissions[0]?.commands?.[0]?.ExerciseCommand.choice).toBe('VestingProposal_Reject')
  })

  // Both parties are accounts of one browser, so the grant a receiver declines can be one this same
  // browser funded and still holds the blob for. Nothing else would ever drop it.
  it('drops the blob of a grant the receiver declined', async () => {
    const acs: Record<string, unknown[]> = {
      [TOKEN]: [tokenRow('t1', '1500'), tokenRow('t2', '1500')],
    }
    const { backend } = harness({ acs })
    await backend.createVesting(grant('First grant'))
    await backend.createVesting(grant('Second grant'))

    await backend.rejectProposal({ receiver: 'receiver::1', pendingCid: 'pending-for-t1' })

    expect(storedTokens().map((one) => one.contractId)).toEqual(['funding-t2'])
  })

  it('drops the blob of the grant it ended and keeps every other one', async () => {
    const acs: Record<string, unknown[]> = {
      [TOKEN]: [tokenRow('t1', '1500'), tokenRow('t2', '1500')],
    }
    const { backend } = harness({ acs })
    await backend.createVesting(grant('First grant'))
    await backend.createVesting(grant('Second grant'))

    await backend.cancelProposal({ proposer: 'funder::1', pendingCid: 'pending-for-t1' })

    expect(storedTokens().map((one) => one.contractId)).toEqual(['funding-t2'])
  })

  it('drops the read misses counted against the grant it ended', async () => {
    const { backend } = harness({
      acs: { [TOKEN]: [tokenRow('t1', '500')], [PENDING]: [reserving('archived-elsewhere')] },
    })
    await backend.viewAs('funder::1')
    expect(readMisses()['archived-elsewhere']).toBe(1)

    await backend.cancelProposal({
      proposer: 'funder::1',
      pendingCid: 'pending-archived-elsewhere',
    })

    expect(readMisses()).toEqual({})
  })

  it('refuses to end a grant that is no longer outstanding', async () => {
    const { backend, submissions } = harness()

    await expect(
      backend.cancelProposal({ proposer: 'funder::1', pendingCid: 'pending-for-t1' }),
    ).rejects.toThrow(/no longer outstanding/)
    expect(submissions).toHaveLength(0)
  })

  // A prompt the wallet declines leaves a grant that is still outstanding and still acceptable, so
  // forgetting its blob would break the one thing this browser is holding for it.
  it('keeps the blob when the wallet declines the cancel', async () => {
    const acs: Record<string, unknown[]> = { [TOKEN]: [tokenRow('t1', '1500')] }
    const funder = harness({ acs })
    await funder.backend.createVesting(grant())
    const declined = harness({ acs, declines: true })

    await expect(
      declined.backend.cancelProposal({ proposer: 'funder::1', pendingCid: 'pending-for-t1' }),
    ).rejects.toThrow(/rejected/)

    expect(storedTokens().map((one) => one.contractId)).toEqual(['funding-t1'])
  })

  // The other way round: the exit is already on the ledger, so a browser that refuses to write must
  // not report a failure the funder would read as the grant surviving.
  it('reports a cancel this browser cannot record as done', async () => {
    const acs: Record<string, unknown[]> = { [TOKEN]: [tokenRow('t1', '1500')] }
    const { backend } = harness({ acs })
    await backend.createVesting(grant())
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('storage is blocked', 'SecurityError')
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await expect(
      backend.cancelProposal({ proposer: 'funder::1', pendingCid: 'pending-for-t1' }),
    ).resolves.toBeUndefined()

    expect(warn).toHaveBeenCalled()
    setItem.mockRestore()
    warn.mockRestore()
  })

  // Criterion 3, and it costs no ledger work: the holding is excluded only while a proposal names
  // it, so archiving the proposal is what returns it.
  it('returns the reserved holding to the funder’s balance', async () => {
    const acs: Record<string, unknown[]> = { [TOKEN]: [tokenRow('t1', '1500')] }
    const { backend } = harness({ acs })
    await backend.createVesting(grant())
    expect(await backend.balanceOf('funder::1')).toBe('500')

    await backend.cancelProposal({ proposer: 'funder::1', pendingCid: 'pending-for-t1' })
    // The harness settles only the factory choice, so the archive the participant would do is done
    // here.
    acs[PENDING] = []

    expect(await backend.balanceOf('funder::1')).toBe('1500')
  })
})

describe('LedgerBackend.viewAs', () => {
  // Coerced to an empty list, a reply the participant could not have meant reads as a party that
  // holds nothing and owns no grants: a blank dashboard for a failure, and the reconcile below
  // unable to tell a reservation that is gone from one it never saw.
  it('reports a reply that is not a list of contracts rather than reading it as an empty ACS', async () => {
    const backend = new LedgerBackend(deployment, {
      execute: async () => ({}),
      ledgerApi: async (params) => {
        const read = params as Read
        return read.resource === '/v2/state/ledger-end' ? { offset: 42 } : { error: 'UNAVAILABLE' }
      },
    })

    await expect(backend.viewAs('funder::1')).rejects.toThrow(/list of contracts/)
  })

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

  // The reconcile is the funder's alone: only they can read the holding a grant reserves, so
  // reading the holdings on a receiver's every poll would buy nothing.
  it('leaves the holdings unread for a party whose pending grants are all incoming', async () => {
    const acs: Record<string, unknown[]> = { [TOKEN]: [tokenRow('t1', '1500')] }
    const funder = harness({ acs })
    await funder.backend.createVesting({
      proposer: 'funder::1',
      receiver: 'receiver::1',
      totalAmount: '1000',
      schedule,
      title: 'Advisor grant',
    })
    // Cleared, so the blob being absent is not what keeps the read away: the receiver could never
    // supply it, and it is whose grant this is that decides.
    localStorage.clear()
    const { backend, reads } = harness({ acs })

    await backend.viewAs('receiver::1')

    expect(reads.filter((read) => filteredTemplate(read) === TOKEN)).toEqual([])
  })

  // A dashboard that goes blank because a background repair failed would be a worse bug than the
  // one the repair is there for.
  it('returns the view even when the holdings cannot be read back', async () => {
    const acs: Record<string, unknown[]> = { [TOKEN]: [tokenRow('t1', '1500')] }
    const funder = harness({ acs })
    await funder.backend.createVesting({
      proposer: 'funder::1',
      receiver: 'receiver::1',
      totalAmount: '1000',
      schedule,
      title: 'Advisor grant',
    })
    localStorage.clear()
    const { backend } = harness({ acs, readsFailOnBlobs: true })

    const view = await backend.viewAs('funder::1')

    expect(view.pendingGrants.map((one) => one.title)).toEqual(['Advisor grant'])
  })

  // Nothing on-ledger stops a funder spending the reserved holding through their wallet, which
  // leaves a grant nobody can accept. The read that would find it carries a blob per holding, so it
  // is given up on rather than paid for on every view from then on.
  it('stops reading the holdings for a reservation that never turns up', async () => {
    const { backend, reads } = harness({
      acs: { [TOKEN]: [tokenRow('t1', '500')], [PENDING]: [reserving('archived-elsewhere')] },
    })

    for (let view = 0; view < 5; view++) {
      await backend.viewAs('funder::1')
    }

    expect(reads.filter((read) => filteredTemplate(read) === TOKEN)).toHaveLength(3)
  })

  // The state the bound exists for: the reservation is gone and the funder holds nothing else, so
  // an empty read is the only answer they will ever get. `readAcs` throws rather than answering
  // `[]` for a reply it could not read, so this is a real answer and counts like any other.
  it('spends that budget on a read that came back empty, and no more', async () => {
    const { backend, reads } = harness({ acs: { [PENDING]: [reserving('archived-elsewhere')] } })

    for (let view = 0; view < 5; view++) {
      await backend.viewAs('funder::1')
    }

    expect(reads.filter((read) => filteredTemplate(read) === TOKEN)).toHaveLength(3)
  })

  // A holding whose blob the read did not carry is as unusable as one that never came back: nothing
  // can be stored for it, so treating it as found would leave it wanted for good and never reach
  // the limit that stops the read.
  it('counts a holding that comes back without its blob as a miss', async () => {
    const blobless = {
      contractEntry: {
        JsActiveContract: {
          createdEvent: {
            contractId: 'reserved',
            createArgument: { admin: 'instrument-admin::1', instrumentId: 'DBT', amount: '1000' },
          },
        },
      },
    }
    const { backend, reads } = harness({
      acs: { [TOKEN]: [blobless], [PENDING]: [reserving('reserved')] },
    })

    for (let view = 0; view < 5; view++) {
      await backend.viewAs('funder::1')
    }

    expect(reads.filter((read) => filteredTemplate(read) === TOKEN)).toHaveLength(3)
  })

  // Two reconciles can be in flight at once, a dashboard refresh alongside a fresh grant, and each
  // decides what it is missing before either has written. Appending what it found would store the
  // same blob twice, and nothing else bounds the store.
  it('keeps one blob per holding when two reconciles overlap', async () => {
    const acs: Record<string, unknown[]> = { [TOKEN]: [tokenRow('t1', '1500')] }
    const funder = harness({ acs })
    await funder.backend.createVesting({
      proposer: 'funder::1',
      receiver: 'receiver::1',
      totalAmount: '1000',
      schedule,
      title: 'Advisor grant',
    })
    localStorage.clear()
    const { backend } = harness({ acs })

    await Promise.all([backend.viewAs('funder::1'), backend.viewAs('funder::1')])

    expect(storedTokens().map((one) => one.contractId)).toEqual(['funding-t1'])
  })

  // The proposal now stores the admin and the instrument it is denominated in, so a pending grant
  // is filtered like the other two rather than taken on trust.
  it('drops pending grants of another instrument', async () => {
    const pending = (contractId: string, admin: string): unknown =>
      row(contractId, {
        admin,
        instrumentId: 'DBT',
        provider: 'operator::1',
        proposer: 'funder::1',
        receiver: 'receiver::1',
        totalAmount: '1000',
        tokenCid: 'funding',
        schedule: encodeSchedule(schedule),
        note: 'Advisor grant',
      })
    const { backend } = harness({
      acs: { [PENDING]: [pending('mine', 'instrument-admin::1'), pending('theirs', 'other::1')] },
    })

    const view = await backend.viewAs('receiver::1')

    expect(view.pendingGrants.map((one) => one.id)).toEqual(['mine'])
  })

  // The instrument a grant is denominated in comes from the holdings it was funded from, so a
  // deployment pointed at another one sees its own grants and not an empty dashboard.
  it('keeps a grant funded under the deployment’s own instrument', async () => {
    const instrument = { admin: 'other::1', instrumentId: 'XYZ' }
    const { backend } = harness({
      acs: { [TOKEN]: [tokenRow('t1', '1500', instrument)] },
      deployment: { ...deployment, ...instrument },
    })
    await backend.createVesting({
      proposer: 'funder::1',
      receiver: 'receiver::1',
      totalAmount: '1000',
      schedule,
      title: 'Advisor grant',
    })

    const view = await backend.viewAs('funder::1')

    expect(view.pendingGrants.map((one) => one.title)).toEqual(['Advisor grant'])
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
