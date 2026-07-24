import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

export const MENU_ROW_BASE_CLASS =
  'w-full px-4 py-3 rounded-lg bg-surface border border-border ' +
  'hover:border-border-strong focus-visible:outline-none focus-visible:shadow-focus'

interface MenuRowProps {
  label: string
  onClick: () => void
  tone?: 'default' | 'danger'
  // Optional trailing icon rendered at the right edge of the row.
  icon?: ReactNode
  testId?: string
}

export const MenuRow = ({
  label,
  onClick,
  tone = 'default',
  icon,
  testId,
}: MenuRowProps): JSX.Element => (
  <li>
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className={cn(
        MENU_ROW_BASE_CLASS,
        'flex items-center justify-between gap-3 text-left',
        tone === 'danger' && 'text-danger hover:border-danger',
      )}
    >
      <span>{label}</span>
      {icon !== undefined && <span className="shrink-0">{icon}</span>}
    </button>
  </li>
)
