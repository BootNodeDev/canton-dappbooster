// Provider foundation: initial state, the context guard, config identity, picker entries.
// Connect, restore, push, and guard behavior live in the sibling CantonConnectProvider.*.test.tsx
// files, split so vitest can overlap their SDK timer waits.

import type { WalletPickerEntry, WalletPickerFn } from '@canton-network/dapp-sdk'
import { DappSDK } from '@canton-network/dapp-sdk'
import { act, render, waitFor } from '@testing-library/react'
import type { JSX } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCantonConnectContext } from '#src/CantonConnectProvider'
import { createAutoPicker } from '#src/testing/autoPicker'
import { clearDiscoveryStorage } from '#src/testing/discoveryStorage'
import { renderSession } from '#src/testing/renderSession'
import { useSession } from '#src/testing/useSession'

// Selecting the entry would start real pairing; capture what was offered and bail.
const capturePicker =
  (offered: WalletPickerEntry[]): WalletPickerFn =>
  async (entries) => {
    offered.push(...entries)
    throw new Error('cancel')
  }

describe('CantonConnectProvider', () => {
  afterEach(() => {
    clearDiscoveryStorage()

    // A prototype spy survives a failed assertion; restoring here keeps it out of later tests.
    vi.restoreAllMocks()
  })

  it('initial state is idle with no party and not locked', () => {
    const { result } = renderSession(() => useSession(), { appName: 'Test dApp' })

    expect(result.current.status).toBe('idle')
    expect(result.current.party).toBe(undefined)
    expect(result.current.isLocked).toBe(false)
  })

  it('useCantonConnectContext throws when used outside the provider', () => {
    const Naked = (): JSX.Element => {
      useCantonConnectContext()
      return <span />
    }
    expect(() => render(<Naked />)).toThrow(/inside a <CantonConnectProvider>/)
  })

  it('creates the connection actor once, so a rerender inits no second SDK', async () => {
    const initSpy = vi.spyOn(DappSDK.prototype, 'init')

    // Hoisted so only the wrapping config object is fresh on the rerender.
    const walletPicker = createAutoPicker()

    const { rerender } = renderSession(() => useSession(), { walletPicker })

    await waitFor(() => expect(initSpy).toHaveBeenCalledTimes(1))

    rerender()

    expect(initSpy).toHaveBeenCalledTimes(1)
  })

  it('offers a WalletConnect entry when a project id is configured', async () => {
    const offered: WalletPickerEntry[] = []

    const { result } = renderSession(() => useSession(), {
      walletConnectProjectId: 'test-project',
      walletPicker: capturePicker(offered),
    })

    await act(async () => {
      await result.current.connect().catch(() => undefined)
    })

    expect(offered).toEqual([
      expect.objectContaining({ providerId: 'walletconnect', type: 'mobile' }),
    ])
  })

  it('offers no WalletConnect entry without a project id', async () => {
    const offered: WalletPickerEntry[] = []

    const { result } = renderSession(() => useSession(), { walletPicker: capturePicker(offered) })

    await act(async () => {
      await result.current.connect().catch(() => undefined)
    })

    expect(offered).toEqual([])
  })
})
