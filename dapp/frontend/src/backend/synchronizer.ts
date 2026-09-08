// Which synchronizers the wallet's participant will submit to. Read on its own rather than off the
// factory row `config.ts` already carries: that one is three round trips and its answer rebuilds the
// backend, so repeating it to watch for a network switch would re-run every ledger read with it.

import type { LedgerApi } from '@/backend/config'

type ConnectedSynchronizers = { connectedSynchronizers?: { synchronizerId?: string }[] }

export const walletSynchronizers = async (
  ledgerApi: LedgerApi,
  party: string,
): Promise<string[]> => {
  // The party goes in `query`, never spelled into `resource`: a wallet is free to allowlist the
  // resource against the ledger API's own route list, which a path carrying a query string misses.
  const { connectedSynchronizers } = (await ledgerApi({
    requestMethod: 'get',
    resource: '/v2/state/connected-synchronizers',
    query: { party },
  })) as ConnectedSynchronizers
  return (connectedSynchronizers ?? [])
    .map((one) => one.synchronizerId)
    .filter((id): id is string => id !== undefined)
}
