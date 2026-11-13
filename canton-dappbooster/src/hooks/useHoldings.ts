import { toError, useAccount, useLedger } from '@bootnodedev/canton-connect'
import { useCallback, useEffect, useRef, useState } from 'react'
import { readHoldings } from '#src/utils/readHoldings'
import type { Holding } from '#src/utils/sumHoldings'

interface HoldingsState {
  error: Error | undefined
  holdings: readonly Holding[] | undefined
  isLoading: boolean
}

const IDLE: HoldingsState = { error: undefined, holdings: undefined, isLoading: false }
const LOADING: HoldingsState = { error: undefined, holdings: undefined, isLoading: true }

/**
 * Return shape of {@link useHoldings}. `holdings` is `undefined` until the first read answers, and
 * again whenever one fails, so an empty array means the party holds nothing.
 *
 * @category Hooks
 */
export interface UseHoldingsResult {
  error: Error | undefined
  holdings: readonly Holding[] | undefined
  isLoading: boolean
  refetch: () => void
}

/**
 * Every standard holding the connected party owns, one entry per contract, read again whenever the
 * party changes. Imported from `@bootnodedev/canton-dappbooster/connect`. Pair it with
 * {@link sumHoldings} to get one row per instrument, which is what a token list wants. Another
 * party's holdings come from {@link readHoldings}.
 *
 * @throws with no `<CantonConnectProvider>` above it. A failed read lands in `error` instead.
 *
 * @example
 * const { holdings } = useHoldings()
 * const tokens = sumHoldings(holdings ?? [])
 *
 * @category Hooks
 */
export const useHoldings = (): UseHoldingsResult => {
  const { ledgerApi, isReady } = useLedger()
  const { account } = useAccount()
  const partyId = account?.partyId
  const [state, setState] = useState<HoldingsState>(IDLE)
  // Only the newest read may report. Bumped on unmount too, so a read in flight then lands nowhere.
  const newest = useRef(0)

  const load = useCallback((): void => {
    if (!isReady || partyId === undefined) {
      setState(IDLE)
      return
    }
    newest.current += 1
    const request = newest.current
    setState(LOADING)
    readHoldings(ledgerApi, partyId).then(
      (holdings) => {
        if (request === newest.current) setState({ error: undefined, holdings, isLoading: false })
      },
      (err) => {
        if (request === newest.current) setState({ ...IDLE, error: toError(err) })
      },
    )
  }, [isReady, ledgerApi, partyId])

  useEffect(() => {
    load()
    return () => {
      newest.current += 1
    }
  }, [load])

  return { ...state, refetch: load }
}
