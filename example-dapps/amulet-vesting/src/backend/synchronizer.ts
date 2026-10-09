// Which synchronizers the wallet's participant will submit to. Read on its own rather than off
// `config.ts`'s factory row, whose answer rebuilds the backend and would re-run every ledger read.

import { call, type LedgerApi } from '@/backend/config'

type ConnectedSynchronizers = { connectedSynchronizers?: { synchronizerId?: string }[] }

export const walletSynchronizers = async (
  ledgerApi: LedgerApi,
  party: string,
): Promise<string[]> => {
  const { connectedSynchronizers } = await call<ConnectedSynchronizers>(ledgerApi, {
    requestMethod: 'get',
    resource: '/v2/state/connected-synchronizers',
    query: { party },
  })
  return (connectedSynchronizers ?? [])
    .map((one) => one.synchronizerId)
    .filter((id): id is string => id !== undefined)
}
