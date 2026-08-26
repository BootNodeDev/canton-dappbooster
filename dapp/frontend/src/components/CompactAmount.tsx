import { InfoTip } from '@/components/InfoTip'
import { formatCCCompact, formatCCFull, isCompacted } from '@/utils/format'
import { CC } from '@/utils/tokens'

// A Canton Coin figure, abbreviated past 10,000 with the exact one still reachable. Carries no unit
// and no mark, so it suits a line that already spells out CC; `AmountDisplay` wraps it for the rest.
export const CompactAmount = ({ value }: { value: string }): React.JSX.Element => {
  const figure = formatCCCompact(value)
  if (!isCompacted(value)) {
    return <>{figure}</>
  }
  const exact = `${formatCCFull(value)} ${CC.symbol}`
  return (
    <>
      <InfoTip label={exact}>
        <span aria-hidden="true">{figure}</span>
      </InfoTip>
      {/* The tooltip only reveals on hover, so without this the exact figure reaches nobody reading
          by ear, and the abbreviation is the only number the page still holds. */}
      <span className="sr-only">{exact}</span>
    </>
  )
}
