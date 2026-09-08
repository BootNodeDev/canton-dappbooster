// Watches whether the connected wallet can still reach the app's network. A wallet-side switch
// reaches the app through nothing at all — CIP-0103 defines no network-change event and the SDK
// pushes only accounts — so the two ids are re-read rather than waited for.

import { useEffect, useRef, useState } from 'react'
import type { LedgerApi } from '@/backend/config'
import { walletSynchronizers } from '@/backend/synchronizer'
import { fetchAppNetwork } from '@/backend/transferContext'
import { wrongNetwork } from '@/utils/network'

// Backstop for a switch made in a window the user never comes back from.
const RECHECK_MS = 30_000

// Carries the party it was read for, so the previous one's answer is not shown against the new
// one's network while the first read for that party is still out.
type Verdict = { party: string; wrong: boolean }

export const useWrongNetwork = (ledgerApi: LedgerApi, partyId: string | undefined): boolean => {
  const [verdict, setVerdict] = useState<Verdict | undefined>(undefined)
  // wallet-service answers for the one network its `NETWORK` variable names, for as long as it is
  // up, so the app's side is read once and the poll re-reads only the wallet's. Boxed so that an
  // answer carrying no id counts as read; the bare id would re-tap on every check.
  const appNetwork = useRef<{ id: string | undefined } | undefined>(undefined)

  useEffect(() => {
    if (partyId === undefined) {
      return
    }
    let cancelled = false
    // Two checks can be in flight at once — a focus landing mid-interval — and they can answer out
    // of order, so only the last one started is allowed to write.
    let started = 0

    const check = (): void => {
      const seq = ++started
      const app = appNetwork.current ?? fetchAppNetwork(partyId).then((id) => ({ id }))

      void Promise.all([walletSynchronizers(ledgerApi, partyId), app]).then(
        ([wallet, network]) => {
          appNetwork.current = network
          if (!cancelled && seq === started) {
            setVerdict({ party: partyId, wrong: wrongNetwork(wallet, network.id) })
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

  return verdict !== undefined && verdict.party === partyId && verdict.wrong
}
