#!/usr/bin/env node
// The vault's backstage signer; architecture.md's "The operator's own guards" says how it works.

import {
  activeContracts,
  interfaceFilter,
  ledger,
  ledgerEnd,
  submit,
  templateFilter,
} from './ledger-api.mjs'
import {
  allocationsFrom,
  isRaceLost,
  openRequests,
  pairForSettle,
  payoutToAllocate,
  proposalsFrom,
  requestIdFor,
  requestsFrom,
  selectInputs,
} from './vault-decisions.mjs'

const POLL_MS = Number(process.env.VAULT_OPERATOR_POLL_MS || 3000)
// The same rule as the dApp's deployment.ts: the stable hint, separator included.
const VAULT_HINT = 'vault-operator::'

const VAULT_FILTER = '#canton-token-vault:Canton.TokenVault.Vault:Vault'
const CONFIG_FILTER = '#canton-token-forge:Canton.TokenForge.Registry:InstrumentConfig'
const HOLDING_FILTER = '#splice-api-token-holding-v1:Splice.Api.Token.HoldingV1:Holding'
const REQUEST_FILTER =
  '#splice-api-token-allocation-request-v1:Splice.Api.Token.AllocationRequestV1:AllocationRequest'
const ALLOCATION_FILTER = '#splice-api-token-allocation-v1:Splice.Api.Token.AllocationV1:Allocation'
const ALLOCATION_FACTORY =
  '#splice-api-token-allocation-instruction-v1:Splice.Api.Token.AllocationInstructionV1:AllocationFactory'

const PROPOSAL_ENTITY = {
  deposit: 'Canton.TokenVault.DepositProposal:DepositProposal',
  withdraw: 'Canton.TokenVault.WithdrawProposal:WithdrawProposal',
}
const REQUEST_ENTITY = {
  deposit: 'Canton.TokenVault.DepositRequest:DepositRequest',
  withdraw: 'Canton.TokenVault.WithdrawRequest:WithdrawRequest',
}
const ACCEPT_CHOICE = { deposit: 'DepositProposal_Accept', withdraw: 'WithdrawProposal_Accept' }
const SETTLE_CHOICE = { deposit: 'DepositRequest_Settle', withdraw: 'WithdrawRequest_Settle' }

const EMPTY_EXTRA_ARGS = { context: { values: {} }, meta: { values: {} } }

const log = (message) => process.stdout.write(`[vault-operator] ${message}\n`)
const warn = (message) => process.stderr.write(`[vault-operator] ${message}\n`)

const advice = (reason) => new Error(`${reason}: run pnpm run bootstrap`)

const withSynchronizer = (deployment) =>
  deployment.synchronizerId === undefined ? {} : { synchronizerId: deployment.synchronizerId }

const discover = async (offset) => {
  const userId = (await ledger('get', '/v2/authenticated-user'))?.user?.id
  if (typeof userId !== 'string' || userId === '') {
    throw new Error('the participant reported no authenticated user')
  }
  const { rights } = await ledger('get', `/v2/users/${encodeURIComponent(userId)}/rights`)
  const vault = (rights ?? [])
    .map((right) => right?.kind?.CanActAs?.value?.party)
    .filter((party) => typeof party === 'string' && party.startsWith(VAULT_HINT))
    .sort()
    .at(-1)
  if (vault === undefined) {
    throw advice('no vault operator party on this ledger')
  }

  const vaultRow = (await activeContracts(vault, templateFilter(VAULT_FILTER), offset)).find(
    (event) => event.createArgument?.vault === vault,
  )
  if (vaultRow === undefined) {
    throw advice(`no Vault created by ${vault}`)
  }

  // Both instruments off the Vault, so its pair is never mixed with another issuer's.
  const { instrumentId, vaultInstrumentId } = vaultRow.createArgument
  const configOf = async ({ admin, id }) => {
    const found = (await activeContracts(admin, templateFilter(CONFIG_FILTER, true), offset)).find(
      (event) => event.createArgument?.instrumentId === id,
    )
    if (found?.createdEventBlob === undefined) {
      throw advice(`no disclosable ${id} instrument config`)
    }
    return found
  }
  const [underlying, share] = await Promise.all([
    configOf(instrumentId),
    configOf(vaultInstrumentId),
  ])

  return {
    shareFactoryCid: share.contractId,
    synchronizerId: vaultRow.synchronizerId,
    underlying: { ...instrumentId, config: underlying },
    vault,
    vaultCid: vaultRow.contractId,
    vaultPkg: vaultRow.templateId.split(':')[0],
  }
}

const exercise = (templateId, contractId, choice, choiceArgument) => ({
  ExerciseCommand: { templateId, contractId, choice, choiceArgument },
})

// A fresh stamp on every command id, so a genuine retry is never deduplicated as a repeat.
const accept = async (deployment, proposal) => {
  const stamp = Date.now()
  const { kind } = proposal
  const requestId = requestIdFor(kind, proposal.contractId, stamp)
  await submit(`op-accept-${requestId}-${stamp}`, deployment.vault, [
    exercise(
      `${deployment.vaultPkg}:${PROPOSAL_ENTITY[kind]}`,
      proposal.contractId,
      ACCEPT_CHOICE[kind],
      { requestId, vaultCid: deployment.vaultCid },
    ),
  ])
  log(`accepted ${kind} of ${proposal.amount} as ${requestId}`)
}

// The settle archives each escrow, a LockedToken the vault may not see, so each is disclosed.
const escrowDisclosure = async (deployment, { admin: party, cid: contractId }) => {
  const found = await ledger('post', '/v2/events/events-by-contract-id', {
    contractId,
    requestingParties: [party],
    eventFormat: {
      filtersByParty: {
        [party]: {
          cumulative: [
            { identifierFilter: { WildcardFilter: { value: { includeCreatedEventBlob: true } } } },
          ],
        },
      },
      verbose: true,
    },
  })
  const created = found?.created?.createdEvent
  if (created?.createdEventBlob === undefined) {
    throw new Error(`no disclosable escrow at ${contractId}`)
  }
  return {
    contractId,
    createdEventBlob: created.createdEventBlob,
    templateId: created.templateId,
    ...withSynchronizer(deployment),
  }
}

const settleArgument = (deployment, pair) =>
  pair.kind === 'deposit'
    ? {
        allocationCid: pair.allocationCid,
        shareFactoryCid: deployment.shareFactoryCid,
        extraArgs: EMPTY_EXTRA_ARGS,
      }
    : {
        shareAllocationCid: pair.shareAllocationCid,
        payoutAllocationCid: pair.payoutAllocationCid,
        shareFactoryCid: deployment.shareFactoryCid,
        extraArgs: EMPTY_EXTRA_ARGS,
      }

const settle = async (deployment, pair) => {
  const stamp = Date.now()
  const { kind, request } = pair
  const disclosed = await Promise.all(
    pair.escrows.map((escrow) => escrowDisclosure(deployment, escrow)),
  )
  await submit(
    `op-settle-${request.requestId}-${stamp}`,
    deployment.vault,
    [
      exercise(
        `${deployment.vaultPkg}:${REQUEST_ENTITY[kind]}`,
        request.contractId,
        SETTLE_CHOICE[kind],
        settleArgument(deployment, pair),
      ),
    ],
    disclosed,
  )
  log(`settled ${kind} ${request.requestId}`)
}

const vaultHoldings = async (deployment) =>
  (await activeContracts(deployment.vault, interfaceFilter(HOLDING_FILTER))).flatMap((event) => {
    const view = event.interfaceViews?.[0]?.viewValue
    if (view === undefined) return []
    return [
      {
        amount: view.amount,
        contractId: event.contractId,
        instrumentId: view.instrumentId,
        isLocked: view.lock !== null && view.lock !== undefined,
      },
    ]
  })

// The vault sends the payout leg, so it funds it from its own USDX with the issuer's config disclosed.
const allocatePayout = async (deployment, { request, spec }) => {
  const stamp = Date.now()
  const { underlying } = deployment
  const inputHoldingCids = selectInputs({
    amount: spec.transferLeg.amount,
    holdings: await vaultHoldings(deployment),
    instrumentId: { admin: underlying.admin, id: underlying.id },
  })
  if (inputHoldingCids === undefined) {
    throw new Error(`not enough ${underlying.id} held to pay out ${spec.transferLeg.amount}`)
  }
  await submit(
    `op-payout-${request.requestId}-${stamp}`,
    deployment.vault,
    [
      exercise(ALLOCATION_FACTORY, underlying.config.contractId, 'AllocationFactory_Allocate', {
        allocation: spec,
        expectedAdmin: underlying.admin,
        extraArgs: EMPTY_EXTRA_ARGS,
        inputHoldingCids,
        // The request's own time: the factory asserts it lies in the past, by the participant's clock.
        requestedAt: request.settlement.requestedAt,
      }),
    ],
    [
      {
        contractId: underlying.config.contractId,
        createdEventBlob: underlying.config.createdEventBlob,
        templateId: underlying.config.templateId,
        ...withSynchronizer(deployment),
      },
    ],
  )
  log(`funded the payout leg of ${request.requestId} for ${spec.transferLeg.amount}`)
}

// One item failing is that item's problem: the loop keeps signing for the rest.
const attempt = async (what, action) => {
  try {
    await action()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (isRaceLost(message)) {
      log(`${what}: already taken, skipping`)
      return
    }
    // Truncated: a refusal carries its whole trace context and repeats every tick while it lasts.
    warn(`${what}: ${message.slice(0, 300)}`)
  }
}

// One offset per tick, so the requests and the allocations paired against them are one snapshot.
const tick = async () => {
  const offset = await ledgerEnd()
  // Found again every tick: a Vault or config made again since start would leave an id here stale.
  const deployment = await discover(offset)
  const { vault } = deployment

  for (const kind of ['deposit', 'withdraw']) {
    const events = await activeContracts(
      vault,
      templateFilter(`#canton-token-vault:${PROPOSAL_ENTITY[kind]}`),
      offset,
    )
    for (const proposal of proposalsFrom(events, kind, vault)) {
      await attempt(`accept ${kind} ${proposal.contractId.slice(0, 10)}`, () =>
        accept(deployment, proposal),
      )
    }
  }

  const requests = openRequests(
    requestsFrom(await activeContracts(vault, interfaceFilter(REQUEST_FILTER), offset), vault),
    Date.now(),
  )
  if (requests.length === 0) {
    return
  }
  const allocations = allocationsFrom(
    await activeContracts(vault, interfaceFilter(ALLOCATION_FILTER), offset),
  )

  // The payout first, so a withdraw funded this tick settles on the next one.
  for (const owed of payoutToAllocate({ allocations, requests })) {
    await attempt(`payout ${owed.request.requestId}`, () => allocatePayout(deployment, owed))
  }

  for (const pair of pairForSettle({ allocations, requests })) {
    await attempt(`settle ${pair.request.requestId}`, () => settle(deployment, pair))
  }
}

const main = async () => {
  const deployment = await discover(await ledgerEnd())
  log(`vault    ${deployment.vault}`)
  log(`vaultCid ${deployment.vaultCid}`)
  log(`polling every ${POLL_MS}ms`)

  let stop = false
  // Interruptible, so a SIGTERM is answered at once rather than after up to a whole poll period.
  let wake = () => {}
  const waitOrWake = () =>
    new Promise((resolve) => {
      const timer = setTimeout(resolve, POLL_MS)
      wake = () => {
        clearTimeout(timer)
        resolve()
      }
    })

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      stop = true
      log(`${signal}, stopping`)
      wake()
    })
  }

  // Sequential rather than on an interval, so a slow tick never overlaps itself.
  while (!stop) {
    await attempt('tick', tick)
    if (stop) break
    await waitOrWake()
  }
  log('stopped')
}

if (import.meta.main) {
  main().catch((err) => {
    warn(err instanceof Error ? err.message : String(err))
    process.exit(1)
  })
}
