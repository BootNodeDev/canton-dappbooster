import { formatFigure } from '#src/components/TokenInput/formatFigure'
import type { Token } from '#src/providers/TokenListProvider/context'
import { parseAmount } from '#src/utils/tokenAmount'

export const getLockedFigure = ({ locked }: Token): string | undefined =>
  locked !== undefined && parseAmount(locked) === 0n ? undefined : formatFigure(locked)
