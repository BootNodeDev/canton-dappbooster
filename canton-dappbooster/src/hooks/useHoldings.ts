import { type LedgerApiParams, useLedger, useParty } from '@bootnodedev/canton-connect'
import { useCallback, useEffect, useRef, useState } from 'react'
import { valueAt } from '#src/utils/json'
import type { Holding } from '#src/utils/sumHoldings'

// The v1 interface every standard token implements.`#package-name` form survives a package upgrade
const HOLDING_INTERFACE = '#splice-api-token-holding-v1:Splice.Api.Token.HoldingV1:Holding'

const holdingFromView = (view: unknown): Holding | undefined => {
  const value = valueAt(view, 'viewValue')
  const admin = valueAt(value, 'instrumentId', 'admin')
  const id = valueAt(value, 'instrumentId', 'id')
  const amount = valueAt(value, 'amount')

  if (typeof admin !== 'string' || typeof id !== 'string' || typeof amount !== 'string') {
    return undefined
  }

  const lock = valueAt(value, 'lock')

  return { amount, instrumentId: { admin, id }, isLocked: lock !== null && lock !== undefined }
}

const holdingsFromAcsRows = (rows: unknown): readonly Holding[] => {
  if (!Array.isArray(rows)) return []

  return rows.flatMap((row) => {
    const views = valueAt(
      row,
      'contractEntry',
      'JsActiveContract',
      'createdEvent',
      'interfaceViews',
    )
    if (!Array.isArray(views)) return []
    return views.flatMap((view) => holdingFromView(view) ?? [])
  })
}

const acsRequest = (partyId: string, offset: string | number): LedgerApiParams => ({
  requestMethod: 'post',
  resource: '/v2/state/active-contracts',
  body: {
    filter: {
      filtersByParty: {
        [partyId]: {
          cumulative: [
            {
              identifierFilter: {
                InterfaceFilter: {
                  value: { interfaceId: HOLDING_INTERFACE, includeInterfaceView: true },
                },
              },
            },
          ],
        },
      },
    },
    activeAtOffset: offset,
    verbose: true,
  },
})

const readPartyHoldings = async (
  ledgerApi: (params: LedgerApiParams) => Promise<unknown>,
  partyId: string,
): Promise<readonly Holding[]> => {
  const end = await ledgerApi({ requestMethod: 'get', resource: '/v2/state/ledger-end' })
  const offset = valueAt(end, 'offset')
  if (typeof offset !== 'string' && typeof offset !== 'number') {
    throw new Error('the ledger did not return an offset')
  }
  return holdingsFromAcsRows(await ledgerApi(acsRequest(partyId, offset)))
}

interface HoldingsState {
  holdings: readonly Holding[] | undefined
  isLoading: boolean
  error: Error | undefined
}

const IDLE: HoldingsState = { holdings: undefined, isLoading: false, error: undefined }
const LOADING: HoldingsState = { holdings: undefined, isLoading: true, error: undefined }

const toError = (value: unknown): Error =>
  value instanceof Error ? value : new Error(String(value))

/**
 * Return shape of {@link useHoldings}. `holdings` is `undefined` until the first read answers, and
 * again whenever one fails, so an empty array means the party holds nothing.
 *
 * @category Hooks
 */
export interface UseHoldingsResult {
  holdings: readonly Holding[] | undefined
  isLoading: boolean
  error: Error | undefined
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
  const { ledgerApi, isReady } = useLedger()
  const { party } = useParty()
  const partyId = party?.partyId
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
    readPartyHoldings(ledgerApi, partyId).then(
      (holdings) => {
        if (request === newest.current) setState({ holdings, isLoading: false, error: undefined })
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
