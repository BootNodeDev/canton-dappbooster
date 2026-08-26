import type { ReactNode } from 'react'
import { LogoMark } from '@/icons'

export const EmptyState = ({
  title,
  description,
  action,
}: {
  action?: ReactNode
  description?: string
  title: string
}): React.JSX.Element => (
  <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
    <LogoMark width={44} height={44} />
    <h3 className="text-base font-bold text-fg">{title}</h3>
    {description !== undefined && <p className="max-w-sm text-sm text-fg-muted">{description}</p>}
    {action !== undefined && <div className="mt-5">{action}</div>}
  </div>
)
