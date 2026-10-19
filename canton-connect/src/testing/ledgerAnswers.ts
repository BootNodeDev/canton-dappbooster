import type { LedgerCommonSchemas } from '@canton-network/core-ledger-client-types'

const createdEvent = (
  contractId: string,
  createArgument: unknown,
): LedgerCommonSchemas['CreatedEvent'] => ({
  offset: 5,
  nodeId: 0,
  contractId,
  templateId: 'pkg:Main:Grant',
  createArgument,
  witnessParties: ['alice::1220'],
  signatories: ['alice::1220'],
  createdAt: '2026-10-19T12:00:00Z',
  packageName: 'app',
  representativePackageId: 'pkg',
  acsDelta: true,
})

export const acsRow = (
  contractId: string,
  createArgument: unknown,
): LedgerCommonSchemas['JsGetActiveContractsResponse'] => ({
  contractEntry: {
    JsActiveContract: {
      createdEvent: createdEvent(contractId, createArgument),
      synchronizerId: 'global-domain::1220',
      reassignmentCounter: 0,
    },
  },
})

export const acsPage = (
  activeAtOffset: number,
  activeContracts: LedgerCommonSchemas['JsGetActiveContractsResponse'][],
  nextPageToken?: string,
): LedgerCommonSchemas['JsGetActiveContractsPageResponse'] => ({
  activeAtOffset,
  activeContracts,
  nextPageToken,
})

export const created = (
  contractId: string,
  createArgument: unknown,
): LedgerCommonSchemas['Event'] => ({ CreatedEvent: createdEvent(contractId, createArgument) })

export const archived = (contractId: string): LedgerCommonSchemas['Event'] => ({
  ArchivedEvent: {
    offset: 5,
    nodeId: 0,
    contractId,
    templateId: 'pkg:Main:Grant',
    witnessParties: ['alice::1220'],
    packageName: 'app',
  },
})

export const transactionUpdate = (
  offset: number,
  events: LedgerCommonSchemas['Event'][],
): LedgerCommonSchemas['JsGetUpdatesResponse'] => ({
  update: {
    Transaction: {
      value: {
        updateId: `u${offset}`,
        effectiveAt: '2026-10-19T12:00:00Z',
        events,
        offset,
        synchronizerId: 'global-domain::1220',
        recordTime: '2026-10-19T12:00:00Z',
      },
    },
  },
})
