import { ThemeProvider } from '@bootnodedev/canton-dappbooster'
import { LucideProvider } from 'lucide-react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { Backend } from '@/providers/Backend'
import { SessionProvider } from '@/providers/Session'
import { routes } from '@/routes'

const router = createBrowserRouter(routes)

export const App = (): React.JSX.Element => (
  <LucideProvider size={18} strokeWidth={1.8}>
    <ThemeProvider>
      <SessionProvider>
        <Backend>
          <RouterProvider router={router} />
        </Backend>
      </SessionProvider>
    </ThemeProvider>
  </LucideProvider>
)
