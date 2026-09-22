import { useAccount, useLedger } from '@bootnodedev/canton-connect'
import { useCallback, useEffect, useRef, useState } from 'react'
import { valueAt } from '#src/utils/json'
import type { Holding } from '#src/utils/sumHoldings'

// The v1 interface every standard token implements.`#package-name` form survives a package upgrade
const HOLDING_INTERFACE = '#splice-api-token-holding-v1:Splice.Api.Token.HoldingV1:Holding'

const holdingFromView = (view: unknown): Holding | undefined => {
  const admin = valueAt(view, 'instrumentId', 'admin')
  const id = valueAt(view, 'instrumentId', 'id')
  const amount = valueAt(view, 'amount')

  if (typeof admin !== 'string' || typeof id !== 'string' || typeof amount !== 'string') {
    return undefined
  }

  const lock = valueAt(view, 'lock')

  return { amount, instrumentId: { admin, id }, isLocked: lock !== null && lock !== undefined }
}

interface HoldingsState {
  error: Error | undefined
  holdings: readonly Holding[] | undefined
  isLoading: boolean
}

const IDLE: HoldingsState = { error: undefined, holdings: undefined, isLoading: false }
const LOADING: HoldingsState = { error: undefined, holdings: undefined, isLoading: true }

const toError = (value: unknown): Error =>
  value instanceof Error ? value : new Error(String(value))

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
 * {@link sumHoldings} to get one row per instrument, which is what a token list wants.
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
  const { activeContractsByInterface, isReady } = useLedger()
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
    activeContractsByInterface({ interfaceId: HOLDING_INTERFACE, party: partyId }).then(
      (contracts) => {
        const holdings = contracts.flatMap((contract) => holdingFromView(contract.view) ?? [])
        if (request === newest.current) setState({ error: undefined, holdings, isLoading: false })
      },
      (err) => {
        if (request === newest.current) setState({ ...IDLE, error: toError(err) })
      },
    )
  }, [activeContractsByInterface, isReady, partyId])

  useEffect(() => {
    load()
    return () => {
      newest.current += 1
    }
  }, [load])

  return { ...state, refetch: load }
}
