import type { PrepareExecuteParams } from '@canton-network/dapp-sdk'
import { useCallback } from 'react'
import type { CantonConnectProvider } from '#src/CantonConnectProvider'
import { useTxFeed } from '#src/hooks/useTxFeed'
import { useWalletCall } from '#src/hooks/useWalletCall'
import type { TxStatusSnapshot } from '#src/types'

/**
 * Re-exported so callers need no direct `@canton-network/dapp-sdk` dependency for the type.
 */
export type { PrepareExecuteParams }

// An unset `actAs` lets the wallet pick its own primary, which may not be the party the kit shows.
/** Defaults `actAs` to the connected party, leaving a caller's own `actAs` untouched. */
const withActAs = (params: PrepareExecuteParams, partyId: string): PrepareExecuteParams =>
  params.actAs === undefined ? { ...params, actAs: [partyId] } : params

/**
 * Return shape of {@link useExecute}. `execute` resolves once the ledger has executed, not at
 * submission; `lastTx` follows the wallet's `txChanged` pushes, so it moves while `execute` is
 * still pending.
 *
 * @category Hooks
 */
export interface UseExecuteResult {
  execute: (params: PrepareExecuteParams) => Promise<unknown>
  lastTx: TxStatusSnapshot | undefined
  isPending: boolean
  error: Error | undefined
  reset: () => void
}

/**
 * Submits ledger commands and tracks the transaction in `lastTx`, fed by the SDK's `txChanged`
 * event. `actAs` defaults to the party `useAccount` reports, so a submit acts as the party the UI
 * shows rather than the wallet's own primary.
 *
 * @throws with no {@link CantonConnectProvider} above it, and from `execute` where nothing is
 * connected, the wallet is locked or no party is reported. A refused command throws too and lands
 * in `error`, always as an `Error`: see {@link toError}.
 *
 * @example
 * const { execute, lastTx } = useExecute()
 * await execute({ commandId: 'claim-1', commands })
 * lastTx?.status // 'pending' | 'signed' | 'executed' | 'failed'
 *
 * @category Hooks
 */
export const useExecute = (): UseExecuteResult => {
  const { call, isPending, error, reset, connection, sdk } = useWalletCall()

  const lastTx = useTxFeed(sdk, connection)

  const execute = useCallback(
    (params: PrepareExecuteParams): Promise<unknown> =>
      call((walletSdk, actingPartyId) =>
        walletSdk.prepareExecuteAndWait(withActAs(params, actingPartyId)),
      ),
    [call],
  )

  return { execute, lastTx, isPending, error, reset }
}
