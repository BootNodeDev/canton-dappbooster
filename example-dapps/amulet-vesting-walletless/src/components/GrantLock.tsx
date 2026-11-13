import { Lock } from 'lucide-react'
import { cn } from '@/utils/cn'

export const GrantLock = ({ className }: { className?: string }): React.JSX.Element => (
  <span
    className={cn('inline-flex items-center gap-1.5 font-mono text-xs text-fg-muted', className)}
  >
    <Lock size={14} /> Locked
  </span>
)
