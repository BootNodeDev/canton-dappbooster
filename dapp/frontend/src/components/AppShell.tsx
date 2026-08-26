import { Outlet } from 'react-router-dom'
import { Card } from '@/components/Card'
import { Toaster } from '@/components/Toaster'
import { TopBar } from '@/components/TopBar'
import { useConnectErrorToast } from '@/hooks/useConnectErrorToast'
import { useBackend } from '@/providers/Backend'

export const AppShell = (): React.JSX.Element => {
  const { configPending, configError } = useBackend()

  useConnectErrorToast()

  return (
    <div className="flex min-h-screen">
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8">
          {/* The card swaps in asynchronously with no focus move, so `role="alert"` is what
              carries it to a reader. */}
          {configError !== undefined && (
            <Card role="alert" className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <h2 className="text-base font-bold text-danger">No deployment</h2>
              <p className="max-w-lg text-sm text-fg-muted">{configError}</p>
            </Card>
          )}
          {/* Every page needs the deployment, so none mounts before it has resolved either way: a
              page without one renders a connect placeholder a connected user does not need. */}
          {configError === undefined && !configPending && <Outlet />}
        </main>
        <footer className="flex items-center justify-center gap-2 px-5 py-5 text-xs text-fg-muted sm:px-8">
          <span className="size-1.5 rounded-full bg-success" />
          Canton · direct ledger
        </footer>
      </div>
      {/* Inside the router: a toast can carry a `<Link>`, which throws without router context. */}
      <Toaster />
    </div>
  )
}
