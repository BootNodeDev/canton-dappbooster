import type { ReactNode } from 'react'

export const PageTitle = ({
  title,
  action,
}: {
  title: string
  action?: ReactNode
}): React.JSX.Element => (
  <div className="flex flex-wrap items-center gap-4 border-b border-border pb-4">
    <h1 className="text-xl font-extrabold tracking-tight text-fg">{title}</h1>
    <div className="ml-auto">{action}</div>
  </div>
)
