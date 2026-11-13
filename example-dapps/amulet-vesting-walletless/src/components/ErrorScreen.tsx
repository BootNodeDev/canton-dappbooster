import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'

const messageOf = (error: unknown): string => {
  if (isRouteErrorResponse(error)) {
    return `${error.status} ${error.statusText}`
  }
  return error instanceof Error ? error.message : 'The page could not be rendered.'
}

export const ErrorScreen = (): React.JSX.Element => {
  const error = useRouteError()

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-4 px-5">
      <EmptyState
        level={1}
        title="Something broke"
        description={messageOf(error)}
        // A full load, not a Link, because the router's own state is what just failed.
        action={
          <Button size="sm" onClick={() => window.location.assign('/')}>
            Back to grants
          </Button>
        }
      />
      {import.meta.env.DEV && error instanceof Error && error.stack !== undefined && (
        <pre className="max-h-72 overflow-auto rounded-[12px] border border-border bg-surface p-4 font-mono text-xs text-fg-muted">
          {error.stack}
        </pre>
      )}
    </div>
  )
}
