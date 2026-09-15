import { useEffect } from 'react'
import { Outlet, ScrollRestoration } from 'react-router-dom'
import { Card } from '@/components/Card'
import { CreateGrant } from '@/components/CreateGrant'
import { Footer } from '@/components/Footer'
import { Loading } from '@/components/Loading'
import { Toaster } from '@/components/Toaster'
import { TopBar } from '@/components/TopBar'
import { WrongNetwork } from '@/components/WrongNetwork'
import { useConnectErrorToast } from '@/hooks/useConnectErrorToast'
import { useCreateGrant } from '@/hooks/useCreateGrant'
import { useBackend } from '@/providers/Backend'
import type { NetworkStatus } from '@/utils/network'

const NETWORK_CARD: Record<NetworkStatus, { body?: string; title: string }> = {
  ok: { title: 'No deployment' },
  unknown: {
    title: 'Undefined network',
    body: 'Network could not be fetched. This might be a temporary issue, check again in a few minutes.',
  },
  wrong: {
    title: 'Wrong network',
    body: 'The wallet is connected to the wrong network.',
  },
}

export const AppShell = (): React.JSX.Element => {
  const { backend, configPending, configError, networkStatus, sessionPending } = useBackend()
  // Mounted here rather than per page, because `?create=1` is route state: every page that offers
  // the action would otherwise repeat the mount, and a reader can open it from any of them.
  const [creating, setCreating] = useCreateGrant()

  useConnectErrorToast()

  const card = NETWORK_CARD[networkStatus ?? 'unknown']

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
        <WrongNetwork />
        <TopBar />
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl flex-1 overflow-x-clip px-5 py-8 sm:px-8"
        >
          {configError !== undefined && (
            <Card role="alert" className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <h1 className="text-base font-bold text-danger">{card.title}</h1>
              {card.body !== undefined && (
                <p className="max-w-lg text-sm text-fg-muted">{card.body}</p>
              )}
              {networkStatus !== 'wrong' && (
                <p className="max-w-lg text-sm text-fg-muted">{configError}</p>
              )}
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
