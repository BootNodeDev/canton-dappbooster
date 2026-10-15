import type { ReactNode } from 'react'

// The row's gap sets the title-to-lens distance only: `action` is pushed away by its own ml-auto.
export const PageTitle = ({
  title,
  lens,
  action,
}: {
  action?: ReactNode
  lens?: ReactNode
  title: string
}): React.JSX.Element => (
  <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
    <h1 className="text-xl font-extrabold tracking-tight text-fg">{title}</h1>
    {lens}
    <div className="ml-auto">{action}</div>
  </div>
)
