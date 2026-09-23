import type { UseLedgerResult } from '@bootnodedev/canton-connect'
import { useEffect, useState } from 'react'
import { fetchAppNetwork } from '@/backend/transferContext'
import { type NetworkStatus, networkStatus } from '@/utils/network'

const PENDING_MS = 3_000

const RECHECK_MS = 30_000

type Verdict = { networkId: string | undefined; party: string; status: NetworkStatus }

export type ConnectedSynchronizers = UseLedgerResult['connectedSynchronizers']

const walletSynchronizers = async (
  connectedSynchronizers: ConnectedSynchronizers,
  party: string,
): Promise<string[]> =>
  (await connectedSynchronizers({ party })).map((synchronizer) => synchronizer.synchronizerId)

export const useNetworkStatus = (
  connectedSynchronizers: ConnectedSynchronizers,
  partyId: string | undefined,
  networkId: string | undefined,
): NetworkStatus | undefined => {
  const [verdict, setVerdict] = useState<Verdict | undefined>(undefined)

  useEffect(() => {
    if (partyId === undefined) {
      return
    }
    let cancelled = false
    let started = 0
    let misses = 1
    let inFlight = false
    let timer: ReturnType<typeof setTimeout>

    const check = (): void => {
      const seq = ++started
      inFlight = true

      void Promise.all([walletSynchronizers(connectedSynchronizers, partyId), fetchAppNetwork()])
        .then(
          ([wallet, app]) => {
            const status = networkStatus(wallet, app)
            misses = status === 'unknown' ? misses + 1 : 0
            if (!cancelled && seq === started) {
              setVerdict({ networkId, party: partyId, status })
            }
          },
          () => {
            misses += 1
            if (!cancelled && seq === started) {
              setVerdict((prior) =>
                prior?.party === partyId && prior.networkId === networkId
                  ? prior
                  : { networkId, party: partyId, status: 'unknown' },
              )
            }
          },
        )
        .finally(() => {
          inFlight = false
        })
    }

    const checkOnFocus = (): void => {
      if (!inFlight) {
        check()
      }
    }

    const schedule = (): void => {
      timer = setTimeout(
        () => {
          check()
          schedule()
        },
        misses === 0 ? RECHECK_MS : Math.min(PENDING_MS * 2 ** (misses - 1), RECHECK_MS),
      )
    }

    check()
    schedule()
    window.addEventListener('focus', checkOnFocus)

    return () => {
      cancelled = true
      clearTimeout(timer)
      window.removeEventListener('focus', checkOnFocus)
    }
  }, [connectedSynchronizers, networkId, partyId])

  return verdict !== undefined && verdict.party === partyId && verdict.networkId === networkId
    ? verdict.status
    : undefined
}
