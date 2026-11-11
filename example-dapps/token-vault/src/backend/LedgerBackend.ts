import {
  type Holding,
  type InstrumentId,
  readHoldings,
  tokenKey,
} from '@bootnodedev/canton-dappbooster'
import {
  buildAllocateCommand,
  buildCancelProposalCommand,
  buildProposalCommand,
  buildTapCommand,
  type RequestKind,
} from '@/backend/commands'
import type { Deployment, Instrument } from '@/backend/deployment'
import {
  readVaultRequests,
  type VaultProposal,
  type VaultRequest,
  type VaultRequests,
} from '@/backend/requests'
import { selectInputs } from '@/backend/selectInputs'
import type { VaultBackend } from '@/backend/VaultBackend'
import type { DisclosedContract, LedgerCommand, WalletFns } from '@/backend/wallet'

export class LedgerBackend implements VaultBackend {
  private readonly deployment: Deployment
  private readonly wallet: WalletFns

  // Assigned in the body: `erasableSyntaxOnly` rejects a constructor parameter property.
  constructor(deployment: Deployment, wallet: WalletFns) {
    this.deployment = deployment
    this.wallet = wallet
  }

  holdingsOf(partyId: string): Promise<readonly Holding[]> {
    return readHoldings(this.wallet.ledgerApi, partyId)
  }

  requestsOf(partyId: string): Promise<VaultRequests> {
    return readVaultRequests(this.wallet.ledgerApi, {
      party: partyId,
      vault: this.deployment.vault,
    })
  }

  async tap(partyId: string): Promise<void> {
    const { underlying } = this.deployment
    if (underlying.maxPerTap === undefined) {
      throw new Error(`${underlying.symbol} has no faucet`)
    }
    await this.submit(
      partyId,
      buildTapCommand({ amount: underlying.maxPerTap, instrument: underlying, user: partyId }),
      [underlying.config],
    )
  }

  async cancelProposal(partyId: string, proposal: VaultProposal): Promise<void> {
    await this.submit(
      partyId,
      buildCancelProposalCommand({
        kind: proposal.kind,
        proposalCid: proposal.contractId,
        vaultPkg: this.deployment.vaultPkg,
      }),
      [],
    )
  }

  // Inputs are picked here off a fresh read: a stale one is what makes a shortfall reachable.
  async allocate(partyId: string, request: VaultRequest): Promise<void> {
    const instrument = this.instrumentFor(request.instrumentId)
    const inputHoldingCids = selectInputs({
      amount: request.amount,
      holdings: await this.holdingsOf(partyId),
      instrumentId: request.instrumentId,
    })
    if (inputHoldingCids === undefined) {
      throw new Error(`not enough ${instrument.symbol} to fund ${request.amount}`)
    }
    await this.submit(
      partyId,
      // The request's own time, not the browser's: the factory asserts it lies in the past.
      buildAllocateCommand({
        inputHoldingCids,
        instrument,
        requestedAt: request.requestedAt,
        spec: request.spec,
      }),
      [instrument.config],
    )
  }

  async propose(partyId: string, kind: RequestKind, amount: string): Promise<void> {
    const { vault, vaultPkg } = this.deployment
    await this.submit(
      partyId,
      buildProposalCommand({ amount, depositor: partyId, kind, vault, vaultPkg }),
      [],
    )
  }

  // Only the two the Vault names, so an allocation never lands on a factory discovery did not find.
  private instrumentFor(instrumentId: InstrumentId): Instrument {
    const key = tokenKey(instrumentId)
    const found = [this.deployment.underlying, this.deployment.share].find(
      (one) => tokenKey(one) === key,
    )
    if (found === undefined) {
      const { admin, id } = instrumentId
      throw new Error(`this vault does not name an instrument ${id} issued by ${admin}`)
    }
    return found
  }

  // `actAs` is explicit: the wallet's own primary could differ from the party the page shows.
  private async submit(
    actAs: string,
    command: LedgerCommand,
    disclosedContracts: readonly DisclosedContract[],
  ): Promise<void> {
    const { synchronizerId } = this.deployment
    await this.wallet.execute({
      actAs: [actAs],
      readAs: [actAs],
      commands: [command],
      disclosedContracts: [...disclosedContracts],
      ...(synchronizerId === undefined ? {} : { synchronizerId }),
    })
  }
}
