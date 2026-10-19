import { useCallback, useEffect, useRef, useState } from 'react'
import type { ActiveContract, ActiveContractsParams } from '#src/activeContracts'
import { useLedgerReads } from '#src/hooks/useLedger'
import type { LedgerEvent } from '#src/transactions'
import { pollEvery, type WatchSource } from '#src/watch'

/**
 * What {@link useActiveContracts} reads, plus whether to keep it current. `watch` is off by
 * default; `true` polls every 3 seconds, and a {@link WatchSource} drives it from anything else.
 * The source is taken when the watch starts and `decode` when a read does, so neither restarts
 * anything when spelled inline.
 *
 * @example
 * const grants = { templateId: '#my-app:Main:Grant', decode: toGrant }
 * useActiveContracts({ ...grants, watch: true })
 * useActiveContracts({ ...grants, watch: pollEvery(10_000) })
 *
 * @category Hooks
 */
export interface UseActiveContractsParams<Payload> extends ActiveContractsParams<Payload> {
  watch?: boolean | WatchSource
}

/**
 * Return shape of {@link useActiveContracts}. `contracts` is `undefined` until a read answers, so
 * an empty array means the party holds none. A `refetch` keeps them while `isLoading`; a new party
 * or template never shows the previous ones, not even for a render.
 *
 * @category Hooks
 */
export interface UseActiveContractsResult<Payload> {
  contracts: ActiveContract<Payload>[] | undefined
  isLoading: boolean
  error: Error | undefined
  refetch: () => void
}

type ReadState<Payload> = Omit<UseActiveContractsResult<Payload>, 'refetch'> & {
  readKey: string | undefined
}

type Cursor = { readKey: string; offset: number }

const IDLE = {
  readKey: undefined,
  contracts: undefined,
  isLoading: false,
  error: undefined,
} as const

const loading = <Payload>(readKey: string): ReadState<Payload> => ({
  readKey,
  contracts: undefined,
  isLoading: true,
  error: undefined,
})

// Compared in render, not reset in an effect, which would show the previous read for a render.
const visibleState = <Payload>(
  state: ReadState<Payload>,
  readKey: string | undefined,
): ReadState<Payload> => {
  if (readKey === undefined) {
    return IDLE
  }

  return state.readKey === readKey ? state : loading(readKey)
}

const applyEvent = <Payload>(
  contracts: ActiveContract<Payload>[],
  event: LedgerEvent<Payload>,
): ActiveContract<Payload>[] => {
  if (event.kind === 'archived') {
    return contracts.filter((contract) => contract.contractId !== event.contractId)
  }

  return contracts.some((contract) => contract.contractId === event.contract.contractId)
    ? contracts
    : [...contracts, event.contract]
}

/**
 * One template's active contracts as the connected party, kept in React state; with no party,
 * nothing is read. `watch` follows the template's transactions from the read's own offset, so your
 * own write shows on the next tick, or at once after `refetch()`. For a one-off read, reach for
 * {@link useLedger} instead.
 *
 * @throws with no {@link CantonConnectProvider} above it. A failed read lands in `error`.
 *
 * @example
 * const { execute } = useExecute()
 * const { contracts, refetch } = useActiveContracts({
 *   templateId: '#my-app:Main:Grant',
 *   decode: toGrant,
 *   watch: true,
 * })
 * await execute({ commands })
 * refetch()
 *
 * @category Hooks
 */
export const useActiveContracts = <Payload>({
  templateId,
  decode,
  watch = false,
}: UseActiveContractsParams<Payload>): UseActiveContractsResult<Payload> => {
  const { activeContracts, transactions, partyId, isReady } = useLedgerReads()
  const [state, setState] = useState<ReadState<Payload>>(IDLE)

  // Only the newest read may land; bumped on unmount too, so one in flight lands nowhere.
  const newest = useRef(0)
  const cursor = useRef<Cursor | undefined>(undefined)
  const readFailed = useRef(false)
  const following = useRef(false)
  const source = useRef(watch)
  const decoder = useRef(decode)

  const readKey =
    isReady && partyId !== undefined ? JSON.stringify([partyId, templateId]) : undefined
  const canRead = readKey !== undefined
  const isWatching = watch !== false

  useEffect(() => {
    source.current = watch
    decoder.current = decode
  })

  const snapshot = useCallback(
    (keepContracts: boolean): void => {
      newest.current += 1
      readFailed.current = false
      const previous = cursor.current
      cursor.current = undefined

      if (readKey === undefined) {
        setState(IDLE)
        return
      }

      const request = newest.current
      setState((current) =>
        keepContracts && current.readKey === readKey
          ? { ...current, isLoading: true }
          : loading(readKey),
      )

      activeContracts({ templateId, decode: decoder.current }).then(
        ({ contracts, offset }) => {
          if (request !== newest.current) {
            return
          }

          cursor.current = { readKey, offset }
          setState({ readKey, contracts, isLoading: false, error: undefined })
        },
        (error: Error) => {
          if (request !== newest.current) {
            return
          }

          // A kept list still matches the cursor it had: no follow moved it while this read ran.
          cursor.current = keepContracts && previous?.readKey === readKey ? previous : undefined
          readFailed.current = true
          setState((current) => ({ ...current, isLoading: false, error }))
        },
      )
    },
    [activeContracts, readKey, templateId],
  )

  const follow = useCallback((): void => {
    const from = cursor.current

    // A failed read or follow leaves no cursor to follow from, so the tick reads again instead.
    if (from === undefined && readFailed.current) {
      snapshot(true)
      return
    }

    // One follow at a time: two from the same cursor would apply the same transactions twice.
    if (from === undefined || following.current) {
      return
    }

    following.current = true
    const request = newest.current

    transactions({ templateId, decode: decoder.current }, from.offset)
      .then(
        (page) => {
          if (request !== newest.current) {
            return
          }

          cursor.current = { ...from, offset: page.cursor }
          const events = page.transactions.flatMap((transaction) => transaction.events)

          setState((current) => {
            const contracts = events.reduce(
              (into, event) => applyEvent(into, event),
              current.contracts ?? [],
            )

            return contracts === current.contracts && current.error === undefined
              ? current
              : { ...current, contracts, error: undefined }
          })
        },
        (error: Error) => {
          if (request !== newest.current) {
            return
          }

          // The same range can fail every time, as past a participant's list cap: read again.
          cursor.current = undefined
          readFailed.current = true
          setState((current) => ({ ...current, error }))
        },
      )
      .finally(() => {
        following.current = false
      })
  }, [snapshot, templateId, transactions])

  useEffect(() => {
    snapshot(false)

    return () => {
      newest.current += 1
    }
  }, [snapshot])

  useEffect(() => {
    if (!isWatching || !canRead) {
      return undefined
    }

    const current = source.current
    const start = typeof current === 'function' ? current : pollEvery()

    return start(follow)
  }, [canRead, follow, isWatching])

  const refetch = useCallback((): void => snapshot(true), [snapshot])
  const { contracts, isLoading, error } = visibleState(state, readKey)

  return { contracts, isLoading, error, refetch }
}
