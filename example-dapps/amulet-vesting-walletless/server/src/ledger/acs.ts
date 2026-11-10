// The two reads every ledger lookup here starts from: where the ledger is now, and which contracts
// of one template a party sees at that point.

import type { WalletFns } from '#server/ledger/wallet'

type LedgerApi = WalletFns['ledgerApi']

export const templateFilter = (
  party: string,
  templateId: string,
  includeCreatedEventBlob = false,
): Record<string, unknown> => ({
  filtersByParty: {
    [party]: {
      cumulative: [
        {
          identifierFilter: { TemplateFilter: { value: { templateId, includeCreatedEventBlob } } },
        },
      ],
    },
  },
})

export const ledgerEnd = async (ledgerApi: LedgerApi): Promise<string | number> => {
  const { offset } = (await ledgerApi({
    requestMethod: 'get',
    resource: '/v2/state/ledger-end',
  })) as { offset?: string | number }
  if (offset === undefined) {
    throw new Error('the ledger did not return an offset')
  }
  return offset
}

export const readAcs = async <Row>(
  ledgerApi: LedgerApi,
  party: string,
  templateId: string,
  offset: string | number,
  includeCreatedEventBlob = false,
): Promise<Row[]> => {
  const rows = await ledgerApi({
    requestMethod: 'post',
    resource: '/v2/state/active-contracts',
    body: {
      filter: templateFilter(party, templateId, includeCreatedEventBlob),
      activeAtOffset: offset,
      verbose: true,
    },
  })
  return Array.isArray(rows) ? (rows as Row[]) : []
}
