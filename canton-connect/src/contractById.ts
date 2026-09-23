import type { LedgerApiParams } from '@canton-network/dapp-sdk'
import { type ActiveContract, filtersByParty, type LedgerOffset } from '#src/activeContracts'

/**
 * One contract as it was created, with the offset it was archived at where it no longer is
 * active; `archivedOffset` undefined is the whole of "still active".
 *
 * @category Types
 */
export interface ContractByIdResult<Payload = unknown> {
  contract: ActiveContract<Payload>
  archivedOffset: LedgerOffset | undefined
}

/**
 * Who `contractById` reads as: the connected party unless `party` says otherwise.
 * `includeCreatedEventBlob` only serves a disclosure.
 *
 * @example
 * await contractById(contractId, { party: operator, includeCreatedEventBlob: true })
 *
 * @category Types
 */
export interface ContractByIdParams {
  party?: string | string[]
  includeCreatedEventBlob?: boolean
}

type WireCreated = {
  createdEvent?: {
    contractId?: string
    templateId?: string
    createArgument?: unknown
    createdEventBlob?: string
  }
  synchronizerId?: string
}

type WireArchived = { archivedEvent?: { offset?: unknown } }

type ContractEventsAnswer = { created?: WireCreated | null; archived?: WireArchived | null }

export const contractByIdRequest = (
  parties: string[],
  contractId: string,
  { includeCreatedEventBlob = false }: ContractByIdParams,
): LedgerApiParams => ({
  requestMethod: 'post',
  resource: '/v2/events/events-by-contract-id',
  body: {
    contractId,
    eventFormat: {
      verbose: true,
      filtersByParty: filtersByParty(parties, {
        WildcardFilter: { value: { includeCreatedEventBlob } },
      }),
    },
  },
})

const archivedOffsetOf = (archived: WireArchived | null | undefined): LedgerOffset | undefined => {
  const offset = archived?.archivedEvent?.offset

  return typeof offset === 'number' || typeof offset === 'string' ? offset : undefined
}

// A create pruned out from under its archival leaves nothing to report, archived or not.
export const decodeContractById = <Payload>(
  answer: unknown,
): ContractByIdResult<Payload> | undefined => {
  const { created, archived } = (answer ?? {}) as ContractEventsAnswer
  const event = created?.createdEvent
  if (event?.contractId === undefined || event.templateId === undefined) {
    return undefined
  }

  return {
    contract: {
      contractId: event.contractId,
      templateId: event.templateId,
      payload: event.createArgument as Payload,
      createdEventBlob: event.createdEventBlob,
      synchronizerId: created?.synchronizerId,
    },
    archivedOffset: archivedOffsetOf(archived),
  }
}
