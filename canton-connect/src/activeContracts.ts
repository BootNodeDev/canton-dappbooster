import type { LedgerApiParams, PrepareExecuteParams } from '@canton-network/dapp-sdk'

/**
 * A `disclosedContracts` entry with `contractId` and `templateId` required; the SDK leaves them
 * optional, and a caller threading the id onward needs them typed.
 *
 * @category Types
 */
export type DisclosedContract = NonNullable<PrepareExecuteParams['disclosedContracts']>[number] & {
  contractId: string
  templateId: string
}

/**
 * An active contract, envelope unwrapped. `payload` is the create argument, typed by the
 * caller.
 *
 * @category Types
 */
export interface ActiveContract<Payload = unknown> {
  contractId: string
  templateId: string
  payload: Payload
  createdEventBlob: string | undefined
  synchronizerId: string | undefined
}

/**
 * One template's contracts, as the connected party unless `party` says otherwise.
 * `includeCreatedEventBlob` only serves a disclosure.
 *
 * @example
 * await activeContracts({ templateId: '#my-app:Main:Factory', party: operator, includeCreatedEventBlob: true })
 *
 * @category Types
 */
export interface ActiveContractsParams {
  templateId: string
  party?: string
  includeCreatedEventBlob?: boolean
}

type LedgerOffset = number | string

type AcsRow = {
  contractEntry?: {
    JsActiveContract?: {
      createdEvent?: {
        contractId?: string
        templateId?: string
        createArgument?: unknown
        createdEventBlob?: string
      }
      synchronizerId?: string
    }
  }
}

export const LEDGER_END_REQUEST: LedgerApiParams = {
  requestMethod: 'get',
  resource: '/v2/state/ledger-end',
}

export const offsetOf = (ledgerEnd: unknown): LedgerOffset => {
  const offset = (ledgerEnd as { offset?: unknown } | null)?.offset
  if (typeof offset !== 'number' && typeof offset !== 'string') {
    throw new Error('ledger API returned no offset for ledger-end')
  }
  return offset
}

export const activeContractsRequest = (
  party: string,
  activeAtOffset: LedgerOffset,
  { templateId, includeCreatedEventBlob = false }: ActiveContractsParams,
): LedgerApiParams => ({
  requestMethod: 'post',
  resource: '/v2/state/active-contracts',
  body: {
    activeAtOffset,
    eventFormat: {
      verbose: true,
      filtersByParty: {
        [party]: {
          cumulative: [
            {
              identifierFilter: {
                TemplateFilter: { value: { templateId, includeCreatedEventBlob } },
              },
            },
          ],
        },
      },
    },
  },
})

const decodeRow = <Payload>(row: AcsRow): ActiveContract<Payload> | undefined => {
  const active = row.contractEntry?.JsActiveContract
  const event = active?.createdEvent
  if (event?.contractId === undefined || event.templateId === undefined) {
    return undefined
  }
  return {
    contractId: event.contractId,
    templateId: event.templateId,
    payload: event.createArgument as Payload,
    createdEventBlob: event.createdEventBlob,
    synchronizerId: active?.synchronizerId,
  }
}

const isPresent = <T>(value: T | undefined): value is T => value !== undefined

// Incomplete (un)assignments have no JsActiveContract and are skipped.
export const decodeActiveContracts = <Payload>(rows: unknown): ActiveContract<Payload>[] =>
  Array.isArray(rows) ? rows.map((row: AcsRow) => decodeRow<Payload>(row)).filter(isPresent) : []

/**
 * Turns a contract read with its blob into the disclosure a command carries.
 *
 * @throws without the blob, which the ledger rejects as a disclosure.
 *
 * @example
 * const [factory] = await activeContracts({ templateId: '#my-app:Main:Factory', includeCreatedEventBlob: true })
 * await execute({ commands, disclosedContracts: [toDisclosedContract(factory)] })
 *
 * @category Utilities
 */
export const toDisclosedContract = (contract: ActiveContract): DisclosedContract => {
  if (contract.createdEventBlob === undefined) {
    throw new Error(
      `contract ${contract.contractId} was read without its createdEventBlob - pass includeCreatedEventBlob: true`,
    )
  }
  return {
    templateId: contract.templateId,
    contractId: contract.contractId,
    createdEventBlob: contract.createdEventBlob,
    synchronizerId: contract.synchronizerId,
  }
}
