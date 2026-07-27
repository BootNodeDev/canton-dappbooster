import { MoonIcon, SunIcon } from '@/components/icons'
import { useTheme } from '@/theme/ThemeProvider'

export const ThemeToggle = (): React.JSX.Element => {
  const { resolved, toggle } = useTheme()
  const next = resolved === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className="inline-grid size-9 place-items-center rounded-full border border-border bg-surface text-fg-muted transition-colors hover:border-primary hover:text-primary"
    >
      {resolved === 'dark' ? (
        <MoonIcon width={16} height={16} />
      ) : (
        <SunIcon width={16} height={16} />
      )}
    </button>
  )
}
