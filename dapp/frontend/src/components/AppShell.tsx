import { Outlet, useLocation } from 'react-router-dom'
import { Card } from '@/components/Card'
import { Sidebar } from '@/components/Sidebar'
import { TopBar } from '@/components/TopBar'
import { useConnectErrorToast } from '@/hooks/useConnectErrorToast'
import { useBackend } from '@/providers/BackendProvider'
import { useUiStore } from '@/store/useUiStore'

const titleFor = (pathname: string, role: string): { title: string; crumb: string } => {
  if (pathname.startsWith('/proposals')) {
    return { title: 'Proposals', crumb: role }
  }
  if (pathname.startsWith('/create')) {
    return { title: 'Create grant', crumb: 'Funder' }
  }
  if (pathname.startsWith('/grants/')) {
    return { title: 'Grant detail', crumb: role }
  }
  return { title: role === 'funder' ? 'Granted by me' : 'Dashboard', crumb: role }
}

export const AppShell = (): React.JSX.Element => {
  const role = useUiStore((s) => s.role)
  const location = useLocation()
  const { configPending, configError } = useBackend()

  useConnectErrorToast()
  const { title, crumb } = titleFor(location.pathname, role)

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title={title} crumb={crumb} />
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
      </div>
    </div>
  )
}
