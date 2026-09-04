import type { Token } from '#src/providers/TokenListProvider/context'
import { formatAmount, parseAmount } from '#src/utils/tokenAmount'

export const getLockedFigure = ({ locked }: Token): string | undefined => {
  if (locked === undefined) return undefined
  const scaled = parseAmount(locked)
  return scaled === undefined || scaled === 0n ? undefined : formatAmount(locked)
}
