import { Outlet, useLocation } from 'react-router-dom'
import { ConnectScreen } from '@/components/ConnectScreen'
import { Sidebar } from '@/components/Sidebar'
import { TopBar } from '@/components/TopBar'
import { useConnectErrorToast } from '@/hooks/useConnectErrorToast'
import { useParty } from '@/hooks/useParty'
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
  const { isConnected } = useParty()
  const role = useUiStore((s) => s.role)
  const location = useLocation()

  useConnectErrorToast()
  const { title, crumb } = titleFor(location.pathname, role)

  return !isConnected ? (
    <ConnectScreen />
  ) : (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title={title} crumb={crumb} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
