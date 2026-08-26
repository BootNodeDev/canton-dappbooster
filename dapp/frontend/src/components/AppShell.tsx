import { Outlet } from 'react-router-dom'
import { Card } from '@/components/Card'
import { CreateGrant } from '@/components/CreateGrant'
import { Loading } from '@/components/Loading'
import { Toaster } from '@/components/Toaster'
import { TopBar } from '@/components/TopBar'
import { useConnectErrorToast } from '@/hooks/useConnectErrorToast'
import { useCreateGrant } from '@/hooks/useCreateGrant'
import { useBackend } from '@/providers/Backend'

export const AppShell = (): React.JSX.Element => {
  const { backend, configPending, configError } = useBackend()
  // Mounted here rather than per page, because `?create=1` is route state: every page that offers
  // the action would otherwise repeat the mount, and a reader can open it from any of them. Held
  // until there is a backend so a deep link with no session still lands on the page's connect card.
  const [creating, setCreating] = useCreateGrant()

  useConnectErrorToast()

  return (
    <div className="flex min-h-screen">
      <div className="relative flex min-w-0 flex-1 flex-col">
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
          {configError !== undefined && (
            <Card role="alert" className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <h1 className="text-base font-bold text-danger">No deployment</h1>
              <p className="max-w-lg text-sm text-fg-muted">{configError}</p>
            </Card>
          )}
          {configPending && <Loading />}
          {configError === undefined && !configPending && (
            <>
              <Outlet />
              {creating && backend !== undefined && (
                <CreateGrant onClose={() => setCreating(false)} />
              )}
            </>
          )}
        </main>
        <footer className="flex items-center justify-center gap-2 px-5 py-5 text-xs text-fg-muted sm:px-8">
          <span className="size-1.5 rounded-full bg-success" />
          Canton · direct ledger
        </footer>
      </div>
      <Toaster />
    </div>
  )
}
