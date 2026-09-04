import { useTheme } from '@bootnodedev/canton-dappbooster'
import { Moon, Sun } from 'lucide-react'

export const ThemeToggle = (): React.JSX.Element => {
  const { resolved, toggle } = useTheme()
  const next = resolved === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className="inline-grid size-9 place-items-center rounded-full border border-border bg-surface text-fg-muted transition-colors hover:border-primary hover:text-primary-strong"
    >
      {resolved === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  )
}
