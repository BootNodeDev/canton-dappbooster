import {
  type CantonConnectConfig,
  CantonConnectProvider,
  createMockAdapter,
  useAccount,
} from '@bootnodedev/canton-connect'
import { Identifier, ThemeProvider } from '@bootnodedev/canton-dappbooster'
import { WalletButton } from '@bootnodedev/canton-dappbooster/connect'
import { RemoteAdapter } from '@canton-network/dapp-sdk'
import type { ReactElement } from 'react'

// The mock wallet answers the connect flow and nothing else, so the app runs before a real
// wallet is reachable. A Wallet Gateway is listed when .env names one. See .env.example.
const mockWallet = import.meta.env.VITE_MOCK_WALLET === 'true' ? [createMockAdapter()] : []
const gatewayUrl = import.meta.env.VITE_WALLET_GATEWAY_URL
const gateway = gatewayUrl
  ? [new RemoteAdapter({ name: 'Wallet Gateway', rpcUrl: gatewayUrl })]
  : []

const connectConfig: CantonConnectConfig = {
  appName: 'Canton dApp',
  additionalAdapters: [...mockWallet, ...gateway],
}

const Session = (): ReactElement | null => {
  const { account, status } = useAccount()

  // `idle` is "not determined yet": the provider is still restoring a previous session.
  if (status === 'idle') {
    return null
  }
  if (account === undefined) {
    return <p>No wallet connected.</p>
  }
  return (
    <p>
      Connected as <Identifier label="party" value={account.partyId} />
    </p>
  )
}

export const App = (): ReactElement => (
  <ThemeProvider>
    <CantonConnectProvider config={connectConfig}>
      <main>
        <h1>Canton dApp</h1>
        <WalletButton />
        <Session />
      </main>
    </CantonConnectProvider>
  </ThemeProvider>
)
