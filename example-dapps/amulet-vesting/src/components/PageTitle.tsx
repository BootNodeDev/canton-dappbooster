import type { ReactNode } from 'react'

export const PageTitle = ({
  action,
  description,
  title,
}: {
  action?: ReactNode
  description?: string
  title: string
}): React.JSX.Element => (
  <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
    <div className="min-w-0">
      <h1 className="font-heading text-[1.75rem] font-extrabold leading-tight text-fg sm:text-[1.9rem]">
        {title}
      </h1>
      {description !== undefined && (
        <p className="mt-1.5 max-w-[56ch] text-fg-muted">{description}</p>
      )}
    </div>
    {action !== undefined && (
      <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
        {action}
      </div>
    )}
  </div>
)
