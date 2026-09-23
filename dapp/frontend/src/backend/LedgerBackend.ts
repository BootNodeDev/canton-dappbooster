import {
  type ActiveContract,
  type Transaction,
  toDisclosedContract,
} from '@bootnodedev/canton-connect'
import {
  buildAcceptCommand,
  buildCancelCommand,
  buildClaimResidualCommand,
  buildCreateVestingCommand,
  buildSplitCommand,
  buildTapCommand,
  buildWithdrawCommand,
} from '@/backend/commands'
import type { Deployment } from '@/backend/config'
import { type AppTransferContext, fetchTransferContext } from '@/backend/transferContext'
import {
  type AmuletPayload,
  amuletDso,
  amuletValue,
  type ClaimRecord,
  type CreateVestInput,
  claimChain,
  composeNote,
  contractToClaim,
  contractToGrant,
  contractToPendingGrant,
  pledgedAmulets,
  updatesToClaims,
  type VestingBackend,
  type VestingPayload,
  type VestingView,
} from '@/backend/VestingBackend'
import type { DisclosedContract, LedgerCommand, WalletFns } from '@/backend/wallet'
import { addAmounts, canonicalAmount, compareAmounts } from '@/utils/amount'

const mapContracts = <Payload, T>(
  contracts: ActiveContract<Payload>[],
  mapper: (contract: ActiveContract<Payload>) => T | undefined,
): T[] => contracts.map(mapper).filter((value): value is T => value !== undefined)

const vesting = (entity: string): string => `#amulet-vesting:AmuletVesting:${entity}`
const AMULET = '#splice-amulet:Splice.Amulet:Amulet'

const AMULET_STORE_KEY = 'vesting.amuletDisclosures'

const storedAmulets = (): DisclosedContract[] => {
  try {
    const stored = JSON.parse(localStorage.getItem(AMULET_STORE_KEY) ?? '[]')
    return Array.isArray(stored) ? stored : []
  } catch {
    return []
  }
}

const CLAIM_HISTORY_LIMIT = 1000
const CLAIM_HISTORY_PAGES = 20

export class LedgerBackend implements VestingBackend {
  private readonly wallet: WalletFns
  private readonly factory: DisclosedContract
  private readonly synchronizerId: string | undefined
  private readonly pkg: string

  constructor(deployment: Deployment, wallet: WalletFns) {
    this.wallet = wallet
    this.synchronizerId = deployment.synchronizerId
    this.pkg = deployment.pkg
    this.factory = {
      templateId: this.tid('AmuletVestingFactory'),
      contractId: deployment.factoryCid,
      createdEventBlob: deployment.factoryBlob,
    }
  }

  // The resolved-id twin of `vesting()`: a command carries this spelling, a filter the other one.
  private tid(entity: string): string {
    return `${this.pkg}:AmuletVesting:${entity}`
  }

  private submit(
    actAs: string,
    command: LedgerCommand,
    disclosed: DisclosedContract[],
  ): Promise<unknown> {
    const sync = this.synchronizerId
    return this.wallet.execute({
      actAs: [actAs],
      readAs: [actAs],
      commands: [command],
      disclosedContracts:
        sync === undefined ? disclosed : disclosed.map((one) => ({ ...one, synchronizerId: sync })),
    })
  }

  async balanceOf(partyId: string): Promise<string> {
    const { free } = await this.freeAmulets(partyId)
    return addAmounts(...free.map(amuletValue))
  }

  async viewAs(partyId: string): Promise<VestingView> {
    const [pendingGrants, grants, claims] = await Promise.all([
      this.wallet.activeContracts<VestingPayload>({
        templateId: vesting('AmuletVestingProposal'),
        party: partyId,
      }),
      this.wallet.activeContracts<VestingPayload>({
        templateId: vesting('AmuletVestingContract'),
        party: partyId,
      }),
      this.wallet.activeContracts<VestingPayload>({
        templateId: vesting('AmuletVestedClaim'),
        party: partyId,
      }),
    ])
    return {
      pendingGrants: mapContracts(pendingGrants.contracts, contractToPendingGrant),
      grants: mapContracts(grants.contracts, contractToGrant),
      claims: mapContracts(claims.contracts, contractToClaim),
    }
  }

  async createVesting(args: CreateVestInput): Promise<void> {
    const escrow = await this.splitOff(args.proposer, args.totalAmount)
    const command = buildCreateVestingCommand(this.factory.templateId, this.factory.contractId, {
      proposer: args.proposer,
      receiver: args.receiver,
      totalAmount: args.totalAmount,
      schedule: args.schedule,
      amuletCids: [escrow.contractId],
      note: composeNote(args.title, args.note),
    })
    await this.submit(args.proposer, command, [this.factory])
    localStorage.setItem(AMULET_STORE_KEY, JSON.stringify([...storedAmulets(), escrow]))
  }

  private async freeAmulets(
    owner: string,
  ): Promise<{ free: ActiveContract<AmuletPayload>[]; held: ActiveContract<AmuletPayload>[] }> {
    const [heldSnapshot, pending] = await Promise.all([
      this.wallet.activeContracts<AmuletPayload>({ templateId: AMULET, party: owner }),
      this.wallet.activeContracts<VestingPayload>({
        templateId: vesting('AmuletVestingProposal'),
        party: owner,
      }),
    ])
    const held = heldSnapshot.contracts
    const pledged = new Set(pending.contracts.flatMap(pledgedAmulets))
    return { free: held.filter((contract) => !pledged.has(contract.contractId)), held }
  }

  private async submitWithContext(
    actAs: string,
    build: (ctx: AppTransferContext, rulesTemplateId: string) => LedgerCommand,
    extra: DisclosedContract[] = [],
  ): Promise<void> {
    const { ctx, disclosed, rulesTemplateId } = await fetchTransferContext()
    await this.submit(actAs, build(ctx, rulesTemplateId), [...disclosed, ...extra])
  }

  private async splitOff(owner: string, amount: string): Promise<DisclosedContract> {
    const [{ free, held }, { ctx, disclosed, rulesTemplateId }] = await Promise.all([
      this.freeAmulets(owner),
      fetchTransferContext(),
    ])
    const freeTotal = addAmounts(...free.map(amuletValue))
    if (compareAmounts(freeTotal, amount) < 0) {
      throw new Error(
        `only ${freeTotal} AMT is free to fund this grant — the rest is pledged to a pending one`,
      )
    }
    const dso = free.map(amuletDso).find((party) => party !== undefined)
    if (dso === undefined) {
      throw new Error('the Amulets funding this grant name no DSO party')
    }

    await this.submit(
      owner,
      buildSplitCommand(rulesTemplateId, ctx.amuletRules, {
        amount,
        amuletCids: free.map((contract) => contract.contractId),
        dso,
        openMiningRound: ctx.openMiningRound,
        owner,
      }),
      disclosed,
    )

    const before = new Set(held.map((contract) => contract.contractId))
    const wanted = canonicalAmount(amount)
    const after = await this.wallet.activeContracts<AmuletPayload>({
      templateId: AMULET,
      party: owner,
      includeCreatedEventBlob: true,
    })
    const created = after.contracts.find(
      (contract) =>
        !before.has(contract.contractId) && canonicalAmount(amuletValue(contract)) === wanted,
    )
    if (created === undefined) {
      throw new Error('the split produced no Amulet of the grant amount')
    }
    return toDisclosedContract(created)
  }

  // One endInclusive across pages keeps them one snapshot.
  async claimHistory(partyId: string, contractCid: string): Promise<ClaimRecord[]> {
    const endInclusive = await this.wallet.ledgerEnd()
    const records: ClaimRecord[] = []
    let beginExclusive: string | number = 0
    for (let page = 0; page < CLAIM_HISTORY_PAGES; page++) {
      const transactions: Transaction<VestingPayload>[] = await this.wallet.transactions({
        templateId: vesting('AmuletVestingContract'),
        party: partyId,
        beginExclusive,
        endInclusive,
        limit: CLAIM_HISTORY_LIMIT,
      })
      records.push(...updatesToClaims(transactions))
      const last = transactions.at(-1)?.offset
      if (transactions.length < CLAIM_HISTORY_LIMIT || last === undefined) {
        break
      }
      beginExclusive = last
    }
    return claimChain(records, contractCid)
  }

  async accept(args: { receiver: string; pendingCid: string }): Promise<void> {
    const { contracts } = await this.wallet.activeContracts<VestingPayload>({
      templateId: vesting('AmuletVestingProposal'),
      party: args.receiver,
    })
    const wanted = new Set(
      contracts
        .filter((contract) => contract.contractId === args.pendingCid)
        .flatMap(pledgedAmulets),
    )
    const amulets = storedAmulets().filter((amulet) => wanted.has(amulet.contractId))
    if (wanted.size === 0 || amulets.length !== wanted.size) {
      throw new Error('the funder Amulets this grant locks are not disclosable from this browser')
    }
    await this.submitWithContext(
      args.receiver,
      (ctx) => buildAcceptCommand(this.tid('AmuletVestingProposal'), args.pendingCid, ctx),
      amulets,
    )
    // The submission archived them, so their blobs can only mislead a later Accept from here on.
    localStorage.setItem(
      AMULET_STORE_KEY,
      JSON.stringify(storedAmulets().filter((amulet) => !wanted.has(amulet.contractId))),
    )
  }

  async withdraw(args: { receiver: string; contractCid: string; amount: string }): Promise<void> {
    await this.submitWithContext(args.receiver, (ctx) =>
      buildWithdrawCommand(this.tid('AmuletVestingContract'), args.contractCid, args.amount, ctx),
    )
  }

  async cancel(args: { creator: string; contractCid: string }): Promise<void> {
    await this.submitWithContext(args.creator, (ctx) =>
      buildCancelCommand(this.tid('AmuletVestingContract'), args.contractCid, ctx),
    )
  }

  async claimResidual(args: { receiver: string; claimCid: string; amount: string }): Promise<void> {
    await this.submitWithContext(args.receiver, (ctx) =>
      buildClaimResidualCommand(this.tid('AmuletVestedClaim'), args.claimCid, args.amount, ctx),
    )
  }

  // The only write not on an amulet-vesting template: it exercises AmuletRules itself.
  async tap(partyId: string): Promise<void> {
    await this.submitWithContext(partyId, (ctx, rulesTemplateId) =>
      buildTapCommand(rulesTemplateId, ctx.amuletRules, {
        openMiningRound: ctx.openMiningRound,
        receiver: partyId,
      }),
    )
  }
}
