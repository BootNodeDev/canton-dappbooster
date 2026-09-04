import type { InstrumentId, Token } from '#src/providers/TokenListProvider/context'
import { tokenKey } from '#src/utils/tokenKey'

/**
 * What one source knows about a token: its instrument id, and whichever fields it can fill.
 *
 * @example
 * const fromRegistry: PartialToken[] = [{ instrumentId, name: 'Canton Coin', symbol: 'CC' }]
 *
 * @category Utilities
 */
export type PartialToken = Partial<Omit<Token, 'instrumentId'>> & { instrumentId: InstrumentId }

const fill = (into: PartialToken, from: PartialToken): PartialToken => {
  const merged = { ...into }
  for (const [field, value] of Object.entries(from)) {
    // An undefined field is a source with nothing to say, never an instruction to forget.
    if (value !== undefined) Object.assign(merged, { [field]: value })
  }
  return merged
}

/**
 * Builds one row per instrument out of every source that knows about it, later sources winning
 * field by field. A row is a token the picker can offer, so the union is the catalogue and a
 * holdings source only annotates it: a token nobody holds is still a row, and one nothing named is
 * a row under its own id.
 *
 * @example
 * mergeTokens([[{ instrumentId, symbol: 'CC' }], sumHoldings(holdings)])
 *
 * @category Utilities
 */
export const mergeTokens = (sources: readonly (readonly PartialToken[])[]): readonly Token[] => {
  const rows = new Map<string, PartialToken>()

  for (const source of sources) {
    for (const partial of source) {
      const key = tokenKey(partial.instrumentId)
      rows.set(key, fill(rows.get(key) ?? { instrumentId: partial.instrumentId }, partial))
    }
  }

  return [...rows.values()].map((row) => ({
    ...row,
    name: row.name ?? row.instrumentId.id,
    symbol: row.symbol ?? row.instrumentId.id,
  }))
}
