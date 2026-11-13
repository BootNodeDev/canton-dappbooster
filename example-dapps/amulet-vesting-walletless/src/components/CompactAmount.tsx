import { InfoTip } from '@/components/InfoTip'
import { formatFigureCompact, formatFigureFull, isCompacted } from '@/utils/format'
import { AMT } from '@/utils/tokens'

export const CompactAmount = ({
  value,
  plain = false,
}: {
  plain?: boolean
  value: string
}): React.JSX.Element => {
  const figure = formatFigureCompact(value)
  if (!isCompacted(value)) {
    return <>{figure}</>
  }
  const exact = formatFigureFull(value)
  // `plain` is for a caller inside a button, where the tooltip trigger cannot legally nest.
  if (plain) {
    return (
      <>
        <span aria-hidden="true">{figure}</span>
        <span className="sr-only">{exact}</span>
      </>
    )
  }
  const labelled = `${exact} ${AMT.symbol}`
  return (
    <>
      <InfoTip label={labelled}>
        <span aria-hidden="true">{figure}</span>
      </InfoTip>
      {/* The tooltip shows on hover only, so this is a screen reader's sole exact figure. */}
      <span className="sr-only">{labelled}</span>
    </>
  )
}
