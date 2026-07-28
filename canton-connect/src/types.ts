// Public types exposed to consumers of canton-connect.

export type ConnectMode = 'extension' | 'walletconnect' | 'preferred'

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected'

export interface Party {
  partyId: string
  network: string
  name?: string
  publicKey?: string
}

export interface ConnectKitConfig {
  appName: string
  appDescription?: string
  appUrl?: string
  // CIP-0103 network id, e.g. 'canton:local'.
  network?: string
  // WalletConnect Reown project id; required for the walletconnect connector
  // but optional in config so dApps that only support the extension path do
  // not need to set it.
  walletConnectProjectId?: string
  // Optional override hooks for testing or for plugging custom connectors.
  extensionConnectorFactory?: () => ExtensionConnector
  walletConnectConnectorFactory?: (opts: WalletConnectConnectorOptions) => WalletConnectConnector
}

export interface WalletConnectConnectorOptions {
  projectId: string
  network: string
  metadata: {
    name: string
    description: string
    url: string
    icons: string[]
  }
  onUri: (uri: string) => void
}

// A connector returns a CIP-0103-compatible Provider that the kit wraps in
// a DappClient. Connectors are intentionally narrow: detect + connect (and
// teardown if applicable). Extension connectors can be absent at runtime
// (the wallet isn't installed); WalletConnect connectors are always present
// but require user action to pair.

export interface ConnectorProvider {
  // The Provider type from @canton-network/core-splice-provider — typed as
  // `unknown` here so canton-connect doesn't force-bundle the type at
  // build time. The kit's internal code treats it as a generic Provider.
  provider: unknown
  providerType: 'browser' | 'remote'
}

export interface ExtensionConnector {
  id: 'extension'
  detect: () => Promise<boolean>
  connect: () => Promise<ConnectorProvider>
}

export interface WalletConnectConnector {
  id: 'walletconnect'
  connect: () => Promise<ConnectorProvider>
}

export type Connector = ExtensionConnector | WalletConnectConnector
