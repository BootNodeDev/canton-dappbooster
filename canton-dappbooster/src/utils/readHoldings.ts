import type { LedgerApiParams } from '@bootnodedev/canton-connect'
import { valueAt } from '#src/utils/json'
import type { Holding } from '#src/utils/sumHoldings'

// The v1 interface every standard token implements. `#package-name` form survives a package upgrade
const HOLDING_INTERFACE = '#splice-api-token-holding-v1:Splice.Api.Token.HoldingV1:Holding'

// A party sees every holding of an instrument it administers, so the owner is checked, not assumed
const holdingFromView = (view: unknown, contractId: string, owner: string): Holding | undefined => {
  const value = valueAt(view, 'viewValue')
  if (valueAt(value, 'owner') !== owner) return undefined

  const admin = valueAt(value, 'instrumentId', 'admin')
  const id = valueAt(value, 'instrumentId', 'id')
  const amount = valueAt(value, 'amount')

  if (typeof admin !== 'string' || typeof id !== 'string' || typeof amount !== 'string') {
    return undefined
  }

  const lock = valueAt(value, 'lock')

  return {
    amount,
    contractId,
    instrumentId: { admin, id },
    isLocked: lock !== null && lock !== undefined,
  }
}

const holdingsFromAcsRows = (rows: unknown, owner: string): readonly Holding[] => {
  if (!Array.isArray(rows)) return []

  return rows.flatMap((row) => {
    const created = valueAt(row, 'contractEntry', 'JsActiveContract', 'createdEvent')
    const contractId = valueAt(created, 'contractId')
    const views = valueAt(created, 'interfaceViews')
    if (typeof contractId !== 'string' || !Array.isArray(views)) return []
    return views.flatMap((view) => holdingFromView(view, contractId, owner) ?? [])
  })
}

const acsRequest = (partyId: string, offset: string | number): LedgerApiParams => ({
  requestMethod: 'post',
  resource: '/v2/state/active-contracts',
  body: {
    eventFormat: {
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
      verbose: true,
    },
    activeAtOffset: offset,
  },
})

/**
 * Every standard holding one party owns, one entry per contract, read at the ledger end. Reach for
 * {@link useHoldings} when the subject is the connected party; this reads any party the caller's
 * `ledgerApi` may see, such as a vault's.
 *
 * @throws when the ledger answers without an offset to read at.
 *
 * @example
 * const holdings = await readHoldings(ledgerApi, partyId)
 * sumHoldings(holdings) // [{ balance: '10.5', instrumentId, locked: '0' }]
 *
 * @category Utilities
 */
export const readHoldings = async (
  ledgerApi: (params: LedgerApiParams) => Promise<unknown>,
  partyId: string,
): Promise<readonly Holding[]> => {
  const end = await ledgerApi({ requestMethod: 'get', resource: '/v2/state/ledger-end' })
  const offset = valueAt(end, 'offset')
  if (typeof offset !== 'string' && typeof offset !== 'number') {
    throw new Error('the ledger did not return an offset')
  }
  return holdingsFromAcsRows(await ledgerApi(acsRequest(partyId, offset)), partyId)
}
