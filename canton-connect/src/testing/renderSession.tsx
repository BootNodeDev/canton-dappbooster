import { renderHook } from '@testing-library/react'
import { CantonConnectProvider } from '#src/CantonConnectProvider'
import { createAutoPicker } from '#src/testing/autoPicker'
import type { CantonConnectConfig } from '#src/types'

const DEFAULT_CONFIG: CantonConnectConfig = { appName: 'test', walletPicker: createAutoPicker() }

/**
 * Renders a hook inside a `CantonConnectProvider`, defaulted to the auto-picker config every
 * provider test starts from; a test only states what it overrides.
 *
 * @example
 * const { result } = renderSession(() => useSession())
 * const { result } = renderSession(() => useSession(), { walletPicker: throwingPicker })
 */
export const renderSession = <Result,>(
  hook: () => Result,
  config: Partial<CantonConnectConfig> = {},
) =>
  renderHook(hook, {
    wrapper: ({ children }) => (
      <CantonConnectProvider config={{ ...DEFAULT_CONFIG, ...config }}>
        {children}
      </CantonConnectProvider>
    ),
  })
