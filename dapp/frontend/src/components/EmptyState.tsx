import type { ReactNode } from 'react'
import { LogoMark } from '@/icons'

// `level` is the rank the surrounding page leaves free: 2 under a PageTitle, 1 where this state
// replaces the page and there is no other heading for it to sit beneath.
export const EmptyState = ({
  title,
  description,
  action,
  level = 2,
}: {
  action?: ReactNode
  description?: string
  level?: 1 | 2
  title: string
}): React.JSX.Element => {
  const Heading = level === 1 ? 'h1' : 'h2'

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
      <LogoMark width={44} height={44} />
      <Heading className="text-base font-bold text-fg">{title}</Heading>
      {description !== undefined && <p className="max-w-sm text-sm text-fg-muted">{description}</p>}
      {action !== undefined && <div className="mt-5">{action}</div>}
    </div>
  )
}
