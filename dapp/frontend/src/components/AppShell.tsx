import { Outlet } from 'react-router-dom'
import { Card } from '@/components/Card'
import { CreateGrant } from '@/components/CreateGrant'
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
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="mx-auto w-full max-w-6xl flex-1 overflow-x-clip px-5 py-8 sm:px-8">
          {configError !== undefined && (
            <Card role="alert" className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <h2 className="text-base font-bold text-danger">No deployment</h2>
              <p className="max-w-lg text-sm text-fg-muted">{configError}</p>
            </Card>
          )}
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
