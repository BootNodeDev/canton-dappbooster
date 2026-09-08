import type { CantonConnectConfig } from '@bootnodedev/canton-connect'
import { CantonConnectProvider, createMockAdapter } from '@bootnodedev/canton-connect'
import { createAutoPicker, FakeSessionProvider } from '@bootnodedev/canton-connect/testing'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'

export const PARTY = 'nico::1220df946c5b01ad0f2d2b480f1f43b1d1f2e498f5a49c2f0b1cbb46'

// Reached through the config rather than the SDK: this package must not import dapp-sdk.
type Picker = NonNullable<CantonConnectConfig['walletPicker']>

/** For the wallet that takes a connect and never answers. */
export const hangingPicker: Picker = () => new Promise(() => {})

export const renderDisconnected = (ui: ReactElement): ReturnType<typeof render> =>
  render(<FakeSessionProvider>{ui}</FakeSessionProvider>)

// The connect flow is the SDK's, so the tests that drive it drive the real provider.
export const renderWithWallet = (
  ui: ReactElement,
  config: { walletPicker?: Picker } = {},
): ReturnType<typeof render> =>
  render(
    <CantonConnectProvider
      config={{
        additionalAdapters: [createMockAdapter({ accounts: [{ partyId: PARTY }] })],
        appName: 'test',
        walletPicker: createAutoPicker('mock'),
        ...config,
      }}
    >
      {ui}
    </CantonConnectProvider>,
  )
