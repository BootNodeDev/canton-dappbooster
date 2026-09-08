// Watches whether the connected wallet can still reach the app's network. A wallet-side switch
// reaches the app through nothing at all — CIP-0103 defines no network-change event and the SDK
// pushes only accounts — so the two ids are re-read rather than waited for.

import { useEffect, useState } from 'react'
import type { LedgerApi } from '@/backend/config'
import { walletSynchronizers } from '@/backend/synchronizer'
import { fetchTransferContext } from '@/backend/transferContext'
import { type WrongNetwork, wrongNetwork } from '@/utils/network'

// Backstop for a switch made in a window the user never comes back from.
const RECHECK_MS = 30_000

export const useWrongNetwork = (
  ledgerApi: LedgerApi,
  partyId: string | undefined,
): WrongNetwork | undefined => {
  const [mismatch, setMismatch] = useState<WrongNetwork | undefined>(undefined)

  useEffect(() => {
    if (partyId === undefined) {
      setMismatch(undefined)
      return
    }
    let cancelled = false

    const check = (): void => {
      void Promise.all([
        walletSynchronizers(ledgerApi, partyId),
        fetchTransferContext(partyId),
      ]).then(
        ([wallet, { synchronizerId }]) => {
          if (!cancelled) {
            setMismatch(wrongNetwork(wallet, synchronizerId))
          }
        },
        // Either read failing says nothing about the network: a wallet-service that is down, or a
        // wallet that has just locked, is not a wrong network. The last answer stands.
        () => undefined,
      )
    }

    check()
    const timer = setInterval(check, RECHECK_MS)
    // Switching networks means using the wallet, which takes focus, so coming back to the page is
    // when a switch has just happened. `visibilitychange` misses it: an extension popup draws over
    // the tab rather than hiding it.
    window.addEventListener('focus', check)

    return () => {
      cancelled = true
      clearInterval(timer)
      window.removeEventListener('focus', check)
    }
  }, [ledgerApi, partyId])

  return mismatch
}
