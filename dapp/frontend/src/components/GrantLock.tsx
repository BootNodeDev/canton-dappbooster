import { Lock } from 'lucide-react'
import { cn } from '@/utils/cn'
import { standInClass } from '@/utils/standIn'

// Stands in for the claim button while nothing is claimable.
export const GrantLock = ({ className }: { className?: string }): React.JSX.Element => (
  <span className={cn(standInClass, className)}>
    <Lock size={14} /> Locked
  </span>
)
