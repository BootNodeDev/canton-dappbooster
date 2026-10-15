import { Lock } from 'lucide-react'
import { cn } from '@/utils/cn'
import { standInClass } from '@/utils/standIn'

export const GrantLock = ({ className }: { className?: string }): React.JSX.Element => (
  <span className={cn(standInClass, className)}>
    <Lock size={14} /> Locked
  </span>
)
