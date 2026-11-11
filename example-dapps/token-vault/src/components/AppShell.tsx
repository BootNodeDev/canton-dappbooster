import { Outlet } from 'react-router-dom'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Footer } from '@/components/Footer'
import { Loading } from '@/components/Loading'
import { Toaster } from '@/components/Toaster'
import { TopBar } from '@/components/TopBar'
import { useConnectErrorToast } from '@/hooks/useConnectErrorToast'
import { useBackend } from '@/providers/Backend'

export const AppShell = (): React.JSX.Element => {
  const { deploymentError, deploymentPending, retryDeployment } = useBackend()

  // Here rather than on the button: a wallet can refuse long after the click, from another page.
  useConnectErrorToast()

  return (
    <div className="relative flex min-h-screen flex-col">
      <a
        href="#main"
        className="absolute left-4 top-4 z-50 -translate-y-24 rounded-[8px] border border-border bg-surface px-4 py-2 text-sm font-semibold text-fg shadow-[var(--shadow-popover)] transition-transform focus-visible:translate-y-0"
      >
        Skip to main content
      </a>
      <TopBar />
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl flex-1 overflow-x-clip px-5 py-8 sm:px-8"
      >
        {deploymentError !== undefined && (
          <Card role="alert" className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <h1 className="text-base font-bold text-danger">No vault</h1>
            <p className="max-w-lg text-sm text-fg-muted">{deploymentError}</p>
            <Button variant="secondary" size="sm" onClick={retryDeployment}>
              Try again
            </Button>
          </Card>
        )}
        {deploymentPending && <Loading />}
        {deploymentError === undefined && !deploymentPending && <Outlet />}
      </main>
      <Footer />
      <Toaster />
    </div>
  )
}
