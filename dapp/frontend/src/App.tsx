import { ThemeProvider, TokenListProvider } from '@bootnodedev/canton-dappbooster'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { Toaster } from '@/components/toast'
import { TOKENS } from '@/mock/tokens'
import { WalletProvider } from '@/providers/WalletProvider'
import { routes } from './routes'

const router = createBrowserRouter(routes)

export const App = (): React.JSX.Element => (
  <ThemeProvider>
    <TokenListProvider tokens={TOKENS}>
      <WalletProvider>
        <RouterProvider router={router} />
        <Toaster />
      </WalletProvider>
    </TokenListProvider>
  </ThemeProvider>
)
