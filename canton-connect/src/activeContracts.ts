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

/**
 * A contract read by interface: `view` is the interface view, the one shape all implementors
 * share.
 *
 * @category Types
 */
export interface InterfaceContract<View = unknown> {
  contractId: string
  templateId: string
  view: View
}

/**
 * One interface's contracts, as the connected party unless `party` says otherwise.
 *
 * @example
 * await activeContractsByInterface({ interfaceId: '#splice-api-token-holding-v1:Splice.Api.Token.HoldingV1:Holding' })
 *
 * @category Types
 */
export interface ActiveContractsByInterfaceParams {
  interfaceId: string
  party?: string
}

/**
 * A ledger offset as `/v2/state/ledger-end` reports it, passed back unchanged.
 *
 * @category Types
 */
export type LedgerOffset = number | string

type InterfaceView = { viewStatus?: { code?: number }; viewValue?: unknown }

type AcsRow = {
  contractEntry?: {
    JsActiveContract?: {
      createdEvent?: {
        contractId?: string
        templateId?: string
        createArgument?: unknown
        createdEventBlob?: string
        interfaceViews?: InterfaceView[]
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

const acsRequest = (
  party: string,
  activeAtOffset: LedgerOffset,
  identifierFilter: Record<string, unknown>,
): LedgerApiParams => ({
  requestMethod: 'post',
  resource: '/v2/state/active-contracts',
  body: {
    activeAtOffset,
    eventFormat: {
      verbose: true,
      filtersByParty: { [party]: { cumulative: [{ identifierFilter }] } },
    },
  },
})

export const activeContractsRequest = (
  party: string,
  activeAtOffset: LedgerOffset,
  { templateId, includeCreatedEventBlob = false }: ActiveContractsParams,
): LedgerApiParams =>
  acsRequest(party, activeAtOffset, {
    TemplateFilter: { value: { templateId, includeCreatedEventBlob } },
  })

export const activeContractsByInterfaceRequest = (
  party: string,
  activeAtOffset: LedgerOffset,
  { interfaceId }: ActiveContractsByInterfaceParams,
): LedgerApiParams =>
  acsRequest(party, activeAtOffset, {
    InterfaceFilter: { value: { interfaceId, includeInterfaceView: true } },
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

// A non-zero viewStatus means the ledger could not compute the view.
const computedView = (view: InterfaceView): boolean =>
  (view.viewStatus?.code ?? 0) === 0 && view.viewValue !== undefined

const decodeInterfaceRow = <View>(row: AcsRow): InterfaceContract<View> | undefined => {
  const event = row.contractEntry?.JsActiveContract?.createdEvent
  const view = event?.interfaceViews?.find(computedView)
  if (event?.contractId === undefined || event.templateId === undefined || view === undefined) {
    return undefined
  }
  return {
    contractId: event.contractId,
    templateId: event.templateId,
    view: view.viewValue as View,
  }
}

const isPresent = <T>(value: T | undefined): value is T => value !== undefined

// Incomplete (un)assignments have no JsActiveContract and are skipped.
export const decodeActiveContracts = <Payload>(rows: unknown): ActiveContract<Payload>[] =>
  Array.isArray(rows) ? rows.map((row: AcsRow) => decodeRow<Payload>(row)).filter(isPresent) : []

export const decodeInterfaceContracts = <View>(rows: unknown): InterfaceContract<View>[] =>
  Array.isArray(rows)
    ? rows.map((row: AcsRow) => decodeInterfaceRow<View>(row)).filter(isPresent)
    : []

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
