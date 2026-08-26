import { CheckIcon } from '@/icons'
import { cn } from '@/utils/cn'
import { standInClass } from '@/utils/standIn'

// Stands in for the claim button once the grant has been drained.
export const GrantClaimed = ({ className }: { className?: string }): React.JSX.Element => (
  <span className={cn(standInClass, className)}>
    <CheckIcon width={14} height={14} /> Fully claimed
  </span>
)
