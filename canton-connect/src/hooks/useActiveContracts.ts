import { useCallback, useEffect, useRef, useState } from 'react'
import type { ActiveContract, ActiveContractsParams, LedgerOffset } from '#src/activeContracts'
import { useLedger } from '#src/hooks/useLedger'
import type { LedgerEvent } from '#src/transactions'
import { pollEvery, type WatchSource } from '#src/watch'

/**
 * What {@link useActiveContracts} reads, plus whether to keep it current. `watch: true` polls;
 * pass a {@link WatchSource} to drive it from something else.
 *
 * @example
 * const once: UseActiveContractsParams = { templateId: '#my-app:Main:Grant' }
 * const live: UseActiveContractsParams = { templateId: '#my-app:Main:Grant', watch: true }
 *
 * @category Types
 */
export interface UseActiveContractsParams extends ActiveContractsParams {
  watch?: boolean | WatchSource
}

/**
 * Return shape of {@link useActiveContracts}. `contracts` is `undefined` until the first read
 * answers, so an empty array means the party holds none.
 *
 * @category Types
 */
export interface UseActiveContractsResult<Payload = unknown> {
  contracts: ActiveContract<Payload>[] | undefined
  isLoading: boolean
  error: Error | undefined
  refetch: () => void
}

interface State<Payload> {
  contracts: ActiveContract<Payload>[] | undefined
  isLoading: boolean
  error: Error | undefined
}

const partyOf = (key: string): string | string[] | undefined =>
  (JSON.parse(key) as string | string[] | null) ?? undefined

const IDLE = { contracts: undefined, isLoading: false, error: undefined } as const
const LOADING = { contracts: undefined, isLoading: true, error: undefined } as const

// Sound only because the caller already filtered by template: an active-contract view cannot be
// rebuilt from events in general, since a consuming exercise omits the archived contract's
// stakeholders and so cannot say whose view it left.
const applyEvent = <Payload>(
  contracts: ActiveContract<Payload>[],
  event: LedgerEvent<Payload>,
): ActiveContract<Payload>[] => {
  if (event.kind === 'created') {
    return contracts.some((one) => one.contractId === event.contract.contractId)
      ? contracts
      : [...contracts, event.contract]
  }
  if (event.kind === 'archived' || event.consuming) {
    return contracts.filter((one) => one.contractId !== event.contractId)
  }

  return contracts
}

/**
 * One template's active contracts, kept in React state, with the read's own offset as the cursor a
 * watch resumes from. Reach for {@link useLedger} where a read is a one-off rather than something a
 * component renders.
 *
 * @throws with no {@link CantonConnectProvider} above it. A failed read lands in `error`.
 *
 * @example
 * const { contracts, isLoading, refetch } = useActiveContracts<{ receiver: string }>({
 *   templateId: '#my-app:Main:Grant',
 *   watch: true,
 * })
 * await execute({ commands })
 * refetch() // your own write needs no tick to wait for
 *
 * @category Hooks
 */
export const useActiveContracts = <Payload = unknown>(
  params: UseActiveContractsParams,
): UseActiveContractsResult<Payload> => {
  const { activeContracts, transactions, isReady } = useLedger()
  const [state, setState] = useState<State<Payload>>(IDLE)

  // Only the newest read may report. Bumped on unmount too, so one in flight then lands nowhere.
  const newest = useRef(0)
  const cursor = useRef<LedgerOffset | undefined>(undefined)

  const { templateId, includeCreatedEventBlob, watch } = params

  // Read through a ref so a source rebuilt each render does not reset the timer it just started.
  const source = useRef(watch)
  source.current = watch

  // The dependency is the party's serialization, not the array, which is a new identity on every
  // render: depending on the array re-reads on every render, and each read renders again.
  const partyKey = JSON.stringify(params.party ?? null)

  const snapshot = useCallback((): void => {
    if (!isReady) {
      setState(IDLE)
      return
    }
    newest.current += 1
    const request = newest.current
    cursor.current = undefined
    setState(LOADING)

    activeContracts<Payload>({
      templateId,
      party: partyOf(partyKey),
      includeCreatedEventBlob,
    }).then(
      ({ contracts, offset }) => {
        if (request !== newest.current) {
          return
        }
        cursor.current = offset
        setState({ contracts, isLoading: false, error: undefined })
      },
      (error: Error) => {
        if (request === newest.current) {
          setState({ ...IDLE, error })
        }
      },
    )
  }, [activeContracts, includeCreatedEventBlob, isReady, partyKey, templateId])

  // A followed create carries no blob, so a read that asked for one re-snapshots instead.
  const follow = useCallback((): void => {
    if (cursor.current === undefined) {
      return
    }
    if (includeCreatedEventBlob === true) {
      snapshot()
      return
    }
    const request = newest.current

    transactions<Payload>({
      templateId,
      party: partyOf(partyKey),
      beginExclusive: cursor.current,
    }).then(
      (page) => {
        const last = page.at(-1)?.offset
        if (request !== newest.current || last === undefined) {
          return
        }
        cursor.current = last
        const events = page.flatMap((transaction) => transaction.events)
        setState((current) => ({
          ...current,
          contracts: events.reduce(
            (into, event) => applyEvent(into, event),
            current.contracts ?? [],
          ),
        }))
      },
      (error: Error) => {
        if (request === newest.current) {
          setState((current) => ({ ...current, error }))
        }
      },
    )
  }, [includeCreatedEventBlob, partyKey, snapshot, templateId, transactions])

  useEffect(() => {
    snapshot()

    return () => {
      newest.current += 1
    }
  }, [snapshot])

  const watching = watch !== undefined && watch !== false

  useEffect(() => {
    if (!watching || !isReady) {
      return undefined
    }
    const current = source.current
    const tick = typeof current === 'function' ? current : pollEvery()

    return tick(follow)
  }, [follow, isReady, watching])

  return { ...state, refetch: snapshot }
}
