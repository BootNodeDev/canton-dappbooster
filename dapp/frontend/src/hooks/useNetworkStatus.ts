import { useEffect, useState } from 'react'
import type { LedgerApi } from '@/backend/config'
import { walletSynchronizers } from '@/backend/synchronizer'
import { fetchAppNetwork } from '@/backend/transferContext'
import { type NetworkStatus, networkStatus } from '@/utils/network'

const PENDING_MS = 3_000

const RECHECK_MS = 30_000

type Verdict = { networkId: string | undefined; party: string; status: NetworkStatus }

export const useNetworkStatus = (
  ledgerApi: LedgerApi,
  partyId: string | undefined,
  networkId: string | undefined,
): NetworkStatus | undefined => {
  const [verdict, setVerdict] = useState<Verdict | undefined>(undefined)

  useEffect(() => {
    if (partyId === undefined) {
      return
    }
    let cancelled = false
    // Two checks can be in flight at once — a focus landing mid-interval — and they can answer out
    // of order, so only the last one started is allowed to write.
    let started = 0
    let answered = false
    let delay = PENDING_MS
    let timer: ReturnType<typeof setTimeout>

    const check = (): void => {
      const seq = ++started

      void Promise.all([walletSynchronizers(ledgerApi, partyId), fetchAppNetwork(partyId)]).then(
        ([wallet, app]) => {
          const status = networkStatus(wallet, app)
          if (!cancelled && seq === started) {
            answered ||= status !== 'unknown'
            setVerdict({ networkId, party: partyId, status })
          }
        },
        // Either read failing says nothing about the network: a wallet-service that is down, or a
        // wallet that has just locked, is not a wrong network. The last answer stands, and where
        // there is none the caller is told the check came back empty rather than left waiting.
        () => {
          if (!cancelled && seq === started) {
            setVerdict((prior) =>
              prior?.party === partyId && prior.networkId === networkId
                ? prior
                : { networkId, party: partyId, status: 'unknown' },
            )
          }
        },
      )
    }

    // Rescheduled from the timer rather than from the answer, so a read that never settles cannot
    // stop the poll.
    const schedule = (): void => {
      timer = setTimeout(() => {
        check()
        delay = answered ? RECHECK_MS : Math.min(delay * 2, RECHECK_MS)
        schedule()
      }, delay)
    }

    check()
    schedule()
    // Switching networks means using the wallet, which takes focus, so coming back to the page is
    // when a switch has just happened. `visibilitychange` misses it: an extension popup draws over
    // the tab rather than hiding it.
    window.addEventListener('focus', check)

    return () => {
      cancelled = true
      clearTimeout(timer)
      window.removeEventListener('focus', check)
    }
  }, [ledgerApi, networkId, partyId])

  return verdict !== undefined && verdict.party === partyId && verdict.networkId === networkId
    ? verdict.status
    : undefined
}
