import { useEffect } from 'react'
import { Outlet, ScrollRestoration } from 'react-router-dom'
import { Card } from '@/components/Card'
import { CreateGrant } from '@/components/CreateGrant'
import { Footer } from '@/components/Footer'
import { Loading } from '@/components/Loading'
import { Toaster } from '@/components/Toaster'
import { TopBar } from '@/components/TopBar'
import { useConnectErrorToast } from '@/hooks/useConnectErrorToast'
import { useCreateGrant } from '@/hooks/useCreateGrant'
import { useBackend } from '@/providers/Backend'

export const AppShell = (): React.JSX.Element => {
  const { backend, configPending, configError, sessionPending } = useBackend()
  // Mounted here rather than per page, because `?create=1` is route state: every page that offers
  // the action would otherwise repeat the mount, and a reader can open it from any of them.
  const [creating, setCreating] = useCreateGrant()

  useConnectErrorToast()

  // A lock or a disconnect takes the action away, so the param goes too: left in the URL it would
  // reopen the dialog on the next connect. Only once the session is settled, or a reload would drop
  // it before the restore has had its chance.
  const noSession = !sessionPending && !configPending && backend === undefined
  useEffect(() => {
    if (creating && noSession) {
      setCreating(false)
    }
  }, [creating, noSession, setCreating])

  return (
    <div className="flex min-h-screen">
      <ScrollRestoration getKey={(location) => location.pathname} />
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
        <Footer />
      </div>
      <Toaster />
    </div>
  )
}
