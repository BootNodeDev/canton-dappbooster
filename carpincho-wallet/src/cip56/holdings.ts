import { walletServiceRequest } from '@/api/walletService'
import { type TokenInstrumentId, tokenDisplayLabel } from '@/cip56/transfers'

export interface TokenHoldingLock {
  holders?: string[]
  expiresAt?: string
  expiresAfter?: string
  context?: string
}

export interface TokenHoldingView {
  owner?: string
  amount?: string
  instrumentId?: TokenInstrumentId
  lock?: TokenHoldingLock | null
  meta?: unknown
}

export interface TokenHolding {
  contractId: string
  interfaceViewValue?: TokenHoldingView
}

export interface TokenHoldingSummary {
  key: string
  tokenLabel: string
  instrumentId?: TokenInstrumentId
  totalAmount: string
  utxoCount?: number
  lockedCount?: number
  unlockedCount?: number
  source?: 'scan' | 'utxos'
  holdings?: TokenHolding[]
}

interface ParsedDecimal {
  scaled: bigint
  scale: number
}

// Creates a stable grouping key for one token instrument.
const holdingInstrumentKey = (instrumentId?: TokenInstrumentId): string =>
  `${instrumentId?.admin ?? 'unknown-admin'}:${instrumentId?.id ?? 'unknown-token'}`

// Compares optional token ids while allowing callers to filter by id-only CC selectors.
const isSameInstrument = (
  actual: TokenInstrumentId | undefined,
  expected: TokenInstrumentId | undefined,
): boolean =>
  expected === undefined ||
  ((expected.id === undefined || actual?.id === expected.id) &&
    (expected.admin === undefined || actual?.admin === expected.admin))

// Parses positive decimal strings from SDK holding amounts without floating point rounding.
const parseDecimalAmount = (value: string): ParsedDecimal | undefined => {
  const trimmed = value.trim()
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return undefined
  }
  const [whole, fraction = ''] = trimmed.split('.')
  return {
    scaled: BigInt(`${whole}${fraction}`),
    scale: fraction.length,
  }
}

// Adds SDK decimal amount strings exactly enough for wallet balance display.
export const sumDecimalAmounts = (values: string[]): string => {
  const parsed = values
    .map(parseDecimalAmount)
    .filter((value): value is ParsedDecimal => value !== undefined)
  if (parsed.length === 0) {
    return '0'
  }
  const scale = Math.max(...parsed.map((value) => value.scale))
  const total = parsed.reduce((acc, value) => {
    const multiplier = 10n ** BigInt(scale - value.scale)
    return acc + value.scaled * multiplier
  }, 0n)
  const raw = total.toString().padStart(scale + 1, '0')
  const whole = raw.slice(0, raw.length - scale)
  const fraction = scale === 0 ? '' : raw.slice(raw.length - scale).replace(/0+$/, '')
  return fraction === '' ? whole : `${whole}.${fraction}`
}

// Builds balance-like token summaries while keeping raw holding contracts available for details.
export const summarizeTokenHoldings = (holdings: TokenHolding[]): TokenHoldingSummary[] => {
  const groups = new Map<string, TokenHolding[]>()
  for (const holding of holdings) {
    const key = holdingInstrumentKey(holding.interfaceViewValue?.instrumentId)
    groups.set(key, [...(groups.get(key) ?? []), holding])
  }
  return [...groups.entries()]
    .map(([key, tokenHoldings]) => {
      const firstView = tokenHoldings[0]?.interfaceViewValue
      const lockedCount = tokenHoldings.filter(
        (holding) => holding.interfaceViewValue?.lock != null,
      ).length
      return {
        key,
        tokenLabel: tokenDisplayLabel(firstView?.instrumentId),
        instrumentId: firstView?.instrumentId,
        totalAmount: sumDecimalAmounts(
          tokenHoldings
            .map((holding) => holding.interfaceViewValue?.amount)
            .filter((amount): amount is string => amount !== undefined),
        ),
        utxoCount: tokenHoldings.length,
        lockedCount,
        unlockedCount: tokenHoldings.length - lockedCount,
        holdings: tokenHoldings,
      }
    })
    .sort((a, b) => a.tokenLabel.localeCompare(b.tokenLabel))
}

// Filters raw UTXOs for the token row the user expanded.
export const filterTokenHoldingsByInstrument = (
  holdings: TokenHolding[],
  instrumentId?: TokenInstrumentId,
): TokenHolding[] =>
  holdings.filter((holding) =>
    isSameInstrument(holding.interfaceViewValue?.instrumentId, instrumentId),
  )

// Reads fast token balance summaries through wallet-service.
export const listTokenHoldingSummaries = async (partyId: string): Promise<TokenHoldingSummary[]> =>
  await walletServiceRequest<TokenHoldingSummary[]>('cip56.listHoldingSummary', { partyId })

// Reads active CIP-56 holding UTXOs through wallet-service.
export const listTokenHoldings = async (partyId: string): Promise<TokenHolding[]> =>
  await walletServiceRequest<TokenHolding[]>('cip56.listHoldings', { partyId })
