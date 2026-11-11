import type { LedgerApiParams } from '@bootnodedev/canton-connect'

export type LedgerApi = (params: LedgerApiParams) => Promise<unknown>

export const call = async <T>(ledgerApi: LedgerApi, params: LedgerApiParams): Promise<T> =>
  (await ledgerApi(params)) as T

type InterfaceView = { interfaceId?: string; viewValue?: Record<string, unknown> }

export type CreatedEvent = {
  contractId?: string
  createArgument?: Record<string, unknown>
  createdEventBlob?: string
  interfaceViews?: InterfaceView[]
  templateId?: string
}

export type AcsEntry = { event: CreatedEvent; synchronizerId?: string }

type AcsFilter = { identifierFilter: Record<string, unknown> }

type AcsRow = {
  contractEntry?: {
    JsActiveContract?: { createdEvent?: CreatedEvent; synchronizerId?: string }
  }
}

export const ledgerEnd = async (ledgerApi: LedgerApi): Promise<string> => {
  const { offset } = await call<{ offset?: string | number }>(ledgerApi, {
    requestMethod: 'get',
    resource: '/v2/state/ledger-end',
  })
  if (offset === undefined) {
    throw new Error('the ledger did not return an offset')
  }
  return String(offset)
}

export const templateFilter = (templateId: string, blob = false): AcsFilter => ({
  identifierFilter: { TemplateFilter: { value: { templateId, includeCreatedEventBlob: blob } } },
})

export const interfaceFilter = (interfaceId: string): AcsFilter => ({
  identifierFilter: { InterfaceFilter: { value: { interfaceId, includeInterfaceView: true } } },
})

export const readAcs = async (
  ledgerApi: LedgerApi,
  { filter, offset, party }: { filter: AcsFilter; offset: string; party: string },
): Promise<AcsEntry[]> => {
  const rows = await call<AcsRow[]>(ledgerApi, {
    requestMethod: 'post',
    resource: '/v2/state/active-contracts',
    body: {
      filter: { filtersByParty: { [party]: { cumulative: [filter] } } },
      activeAtOffset: offset,
      verbose: true,
    },
  })
  if (!Array.isArray(rows)) {
    throw new Error('the participant did not answer with a list of contracts')
  }
  return rows.flatMap((row) => {
    const entry = row.contractEntry?.JsActiveContract
    if (entry?.createdEvent === undefined) return []
    return [
      {
        event: entry.createdEvent,
        ...(entry.synchronizerId === undefined ? {} : { synchronizerId: entry.synchronizerId }),
      },
    ]
  })
}

// One filter per read, so the first view is that interface's; none means the participant failed it.
export const viewOf = (entry: AcsEntry): Record<string, unknown> | undefined =>
  entry.event.interfaceViews?.[0]?.viewValue
