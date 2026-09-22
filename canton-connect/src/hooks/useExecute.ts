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
 * Return shape of {@link useExecute}. `execute` resolves once executed, with the `updateId`
 * `useLedger().transaction` reads back; `lastTx` follows the wallet's `txChanged` pushes.
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
 * Submits ledger commands as the party `useAccount` reports and tracks them in `lastTx`.
 *
 * @throws with no {@link CantonConnectProvider} above it, with no session or party, and when the
 * command fails, which also lands in `error`.
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
