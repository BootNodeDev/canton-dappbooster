import type { ReactNode } from 'react'
import { Card } from './Card'

export const EmptyState = ({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}): React.JSX.Element => (
  <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
    <span className="grid size-12 place-items-center rounded-2xl bg-[image:var(--gradient-brand)] opacity-90" />
    <h3 className="text-base font-bold text-fg">{title}</h3>
    <p className="max-w-sm text-sm text-fg-muted">{description}</p>
    {action}
  </Card>
)
