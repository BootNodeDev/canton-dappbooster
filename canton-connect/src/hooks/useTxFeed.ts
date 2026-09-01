import type { TxChangedEvent } from '@canton-network/dapp-sdk'
import { useSelector } from '@xstate/react'
import { useEffect, useState } from 'react'
import type { ConnectionSubscription, TxStatusSnapshot, WalletSdk } from '#src/types'

// Transactions are orthogonal to the connection lifecycle, so they stay React state rather than
// machine context: nothing about the session depends on the last command's fate. One listener per
// `useExecute`, since it is the only consumer and every listener hears every tx.
/** Tracks the SDK's `txChanged` pushes while a session is active, clearing on session end. */
export const useTxFeed = (
  sdk: WalletSdk,
  connection: ConnectionSubscription,
): TxStatusSnapshot | undefined => {
  const [lastTx, setLastTx] = useState<TxStatusSnapshot | undefined>(undefined)

  const sessionActive = useSelector(connection, (snapshot) => snapshot.matches('session'))

  useEffect(() => {
    if (!sessionActive) {
      setLastTx(undefined)
      return
    }

    const onTx = (event: TxChangedEvent): void => {
      setLastTx({
        status: event.status,
        commandId: event.commandId,
        payload: 'payload' in event ? event.payload : undefined,
      })
    }

    void sdk.onTxChanged(onTx).catch(() => undefined)

    return () => {
      void sdk.removeOnTxChanged(onTx).catch(() => undefined)
    }
  }, [sessionActive, sdk])

  return lastTx
}
