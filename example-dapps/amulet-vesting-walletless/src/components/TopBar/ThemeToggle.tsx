import { useTheme } from '@bootnodedev/canton-dappbooster'
import { Moon, Sun } from 'lucide-react'
import { cn } from '@/utils/cn'

export const roundButtonClass =
  'inline-grid size-[2.375rem] place-items-center rounded-full border border-border bg-surface text-fg-muted transition-colors hover:border-primary hover:text-primary-strong'

export const ThemeToggle = ({ className }: { className?: string }): React.JSX.Element => {
  const { resolved, toggle } = useTheme()
  const next = resolved === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className={cn(roundButtonClass, className)}
    >
      {resolved === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  )
}
