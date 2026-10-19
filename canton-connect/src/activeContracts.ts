import type {
  LedgerCommonSchemas,
  LedgerPathsByVersion,
} from '@canton-network/core-ledger-client-types'
import type { LedgerApiParams } from '@canton-network/dapp-sdk'

/**
 * An active contract, envelope unwrapped. `payload` is its create argument as the caller's
 * `decode` proved it, since only the dApp knows its Daml model. `templateId` comes back as a
 * package id, which a read refuses, so it cannot be passed back as one.
 *
 * @category Types
 */
export interface ActiveContract<Payload> {
  contractId: string
  templateId: string
  payload: Payload
}

/**
 * Which contracts a read asks for: one template's, as the connected party. `templateId` must use
 * the package-name form, `#package-name:Module:Template`: the participant refuses a package id.
 * `decode` proves each payload; a contract it answers `undefined` for is skipped.
 *
 * @example
 * const { activeContracts } = useLedger()
 * await activeContracts({ templateId: '#my-app:Main:Grant', decode: toGrant })
 *
 * @category Types
 */
export interface ActiveContractsParams<Payload> {
  templateId: string
  decode: (createArgument: unknown) => Payload | undefined
}

/**
 * One template's contracts, with the ledger offset the read was taken at.
 *
 * @category Types
 */
export interface ActiveContractsResult<Payload> {
  contracts: ActiveContract<Payload>[]
  offset: number
}

export type Decode<Payload> = ActiveContractsParams<Payload>['decode']

// Canton 3.5 is the floor: the paged read does not exist before it.
export type LedgerPaths = LedgerPathsByVersion['3.5']

type AcsRow = LedgerCommonSchemas['JsGetActiveContractsResponse']

type AcsPage = LedgerCommonSchemas['JsGetActiveContractsPageResponse']

// Partial: the SDK hands the gateway's answer over unchecked, so any field can be missing.
type AcsPageAnswer = Partial<AcsPage>

export const LEDGER_END_REQUEST: LedgerApiParams = {
  requestMethod: 'get',
  resource: '/v2/state/ledger-end' satisfies keyof LedgerPaths,
}

export const offsetOf = (
  ledgerEnd: LedgerCommonSchemas['GetLedgerEndResponse'] | undefined,
): number => {
  const offset = ledgerEnd?.offset

  if (typeof offset !== 'number') {
    throw new Error('ledger API returned no offset for ledger-end')
  }

  return offset
}

export const eventFormat = (
  party: string,
  templateId: string,
): LedgerCommonSchemas['EventFormat'] => ({
  verbose: true,
  filtersByParty: {
    [party]: {
      cumulative: [
        {
          identifierFilter: {
            TemplateFilter: { value: { templateId, includeCreatedEventBlob: false } },
          },
        },
      ],
    },
  },
})

export const activeContractsRequest = (
  party: string,
  templateId: string,
  activeAtOffset: number,
  pageToken: string | undefined,
): LedgerApiParams => ({
  requestMethod: 'post',
  resource: '/v2/state/active-contracts-page' satisfies keyof LedgerPaths,
  // No maxPageSize: the participant's default fits the limit it refuses to go past.
  body: {
    activeAtOffset,
    eventFormat: eventFormat(party, templateId),
    ...(pageToken === undefined ? {} : { pageToken }),
  } satisfies LedgerCommonSchemas['GetActiveContractsPageRequest'],
})

export const pageOf = (
  answer: AcsPageAnswer | undefined,
): Pick<AcsPage, 'activeContracts' | 'nextPageToken'> => {
  // A 3.5.17 participant sends null on the last page, where the spec leaves the token out.
  const token = answer?.nextPageToken

  return {
    activeContracts: Array.isArray(answer?.activeContracts) ? answer.activeContracts : [],
    nextPageToken: typeof token === 'string' && token !== '' ? token : undefined,
  }
}

// The spec requires all three; the gateway can still answer anything.
export const contractOf = <Payload>(
  { contractId, templateId, createArgument }: LedgerCommonSchemas['CreatedEvent'],
  decode: Decode<Payload>,
): ActiveContract<Payload> | undefined => {
  if (contractId === undefined || templateId === undefined || createArgument === undefined) {
    return undefined
  }

  const payload = decode(createArgument)

  return payload === undefined ? undefined : { contractId, templateId, payload }
}

// An incomplete (un)assignment carries no JsActiveContract, so it is skipped.
export const decodeActiveContracts = <Payload>(
  rows: AcsRow[],
  decode: Decode<Payload>,
): ActiveContract<Payload>[] =>
  rows.flatMap(({ contractEntry }) =>
    contractEntry !== undefined && 'JsActiveContract' in contractEntry
      ? (contractOf(contractEntry.JsActiveContract.createdEvent, decode) ?? [])
      : [],
  )
