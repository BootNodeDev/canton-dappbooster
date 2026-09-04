import { formatFigure } from '#src/components/TokenInput/formatFigure'
import type { Token } from '#src/providers/TokenListProvider/context'
import { parseAmount } from '#src/utils/tokenAmount'

export const getLockedFigure = ({ locked }: Token): string | undefined => {
  if (locked === undefined) return undefined
  const scaled = parseAmount(locked)
  return scaled === undefined || scaled === 0n ? undefined : formatFigure(locked)
}
