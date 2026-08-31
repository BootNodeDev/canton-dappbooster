// Restored sessions: what a mount-restore wires, that connect() leaves a standing session
// alone, and what survives a failed or abandoned connect around one.

import { act, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConnectCancelledError } from '#src/connectError'
import { useConnect } from '#src/hooks/useConnect'
import { useParty } from '#src/hooks/useParty'
import { clearDiscoveryStorage, persistRestorableSession } from '#src/testing/discoveryStorage'
import { createFakeWallet } from '#src/testing/fakeWallet'
import { renderSession } from '#src/testing/renderSession'
import { type StubPopup, stubOpen, stubPopup } from '#src/testing/stubPopup'
import { throwingPicker } from '#src/testing/throwingPicker'
import { useSession } from '#src/testing/useSession'
import { walletA } from '#src/testing/walletA'
import { pushLock, pushUnlock } from '#src/testing/walletLock'
import type { WalletSdk } from '#src/types'

let restoreOpen: (() => void) | undefined

// Drives a connect to the point a close strands it: the window only gets a URL once the SDK opened
// it.
const strandOnClosedPicker = async (
  result: { current: { sdk: WalletSdk; connect: () => Promise<void> } },
  popup: StubPopup,
): Promise<WalletSdk> => {
  const stranded = result.current.sdk

  await act(async () => {
    const connecting = expect(result.current.connect()).rejects.toBeInstanceOf(
      ConnectCancelledError,
    )
    await waitFor(() => expect(popup.location.href).not.toBe(''))
    popup.closed = true
    await connecting
  })

  await waitFor(() => expect(result.current.sdk).not.toBe(stranded))
  return stranded
}

describe('CantonConnectProvider restored sessions', () => {
  afterEach(() => {
    clearDiscoveryStorage()

    // A prototype spy survives a failed assertion; restoring here keeps it out of later tests.
    vi.restoreAllMocks()
    restoreOpen?.()
    restoreOpen = undefined
  })

  it('keeps listening through a lock and recovers when the wallet unlocks', async () => {
    persistRestorableSession('browser:ext:wallet-a')

    const wallet = walletA()

    const { result } = renderSession(() => useSession())

    await waitFor(() => expect(result.current.party?.partyId).toBe('alice::1220ab'))

    // A status() read cannot report a locked session: the wallet gates `isConnected` and the
    // presence of `session` on the same lookup. A lock only ever arrives as a push.
    act(() => {
      pushLock(wallet)
    })

    await waitFor(() => expect(result.current.isLocked).toBe(true))
    expect(result.current.status).toBe('connected')
    // A wallet that will not serve requests has no party to offer, and this push cannot be told
    // apart from a wallet-side disconnect.
    expect(result.current.party).toBeUndefined()

    act(() => {
      pushUnlock(wallet)
    })

    await waitFor(() => expect(result.current.isLocked).toBe(false))
    // The session outlived the lock, so the unlock push is heard and the party is read again
    // without the user reconnecting.
    await waitFor(() => expect(result.current.party?.partyId).toBe('alice::1220ab'))

    wallet.dispose()
  })

  it('leaves a locked session alone when connect() is called', async () => {
    persistRestorableSession('browser:ext:wallet-a')

    const wallet = walletA()

    const { result } = renderSession(() => useSession())

    await waitFor(() => expect(result.current.status).toBe('connected'))

    act(() => {
      pushLock(wallet)
    })

    await waitFor(() => expect(result.current.isLocked).toBe(true))

    const connectSpy = vi.spyOn(result.current.sdk, 'connect')

    await act(async () => {
      await result.current.connect()
    })

    // The session stands, so the connect is ignored: still locked, and the wallet never asked.
    expect(result.current.isLocked).toBe(true)
    expect(connectSpy).not.toHaveBeenCalled()

    act(() => {
      pushUnlock(wallet)
    })

    // The ignored connect left the session's listeners intact: the unlock still recovers it.
    await waitFor(() => expect(result.current.party?.partyId).toBe('alice::1220ab'))

    wallet.dispose()
  })

  it('leaves a restored session untouched when connect() is called', async () => {
    persistRestorableSession('browser:ext:wallet-a')

    const wallet = walletA()

    const { result } = renderSession(() => useSession())

    await waitFor(() => expect(result.current.party?.partyId).toBe('alice::1220ab'))

    const removeSpy = vi.spyOn(result.current.sdk, 'removeOnAccountsChanged')
    const connectSpy = vi.spyOn(result.current.sdk, 'connect')

    await act(async () => {
      await result.current.connect()
    })

    // Nothing moved: no listener teardown, no wallet round trip, the party still in hand.
    expect(removeSpy).not.toHaveBeenCalled()
    expect(connectSpy).not.toHaveBeenCalled()
    expect(result.current.party?.partyId).toBe('alice::1220ab')

    wallet.dispose()
  })

  it('keeps delivering events to useParty() after a throwing picker leaves a restored session standing', async () => {
    persistRestorableSession('browser:ext:wallet-a')

    // Restore's internal check, our own restore check, and the post-failure probe all see the same
    // still-live, connected client.
    const wallet = createFakeWallet({
      id: 'wallet-a',
      target: 'wallet-a',
      statusResponses: [true, true, true],
      accounts: [{ partyId: 'alice::1220ab', primary: true }],
    })

    const { result } = renderSession(() => ({ connect: useConnect(), party: useParty() }), {
      walletPicker: throwingPicker,
    })

    await waitFor(() => expect(result.current.party.party?.partyId).toBe('alice::1220ab'))
    expect(result.current.party.status).toBe('connected')

    // The attempt throws before the client is swapped, so the actor's own status read finds the
    // session still live and hands it back: the machine lands in `session` again and connect()
    // resolves. The failure is deliberately not surfaced (the finding-5 ruling); what matters
    // here is that the session and its listeners come through intact.
    await act(async () => {
      await result.current.connect.connect()
    })

    await waitFor(() => expect(result.current.party.party?.partyId).toBe('alice::1220ab'))

    act(() => {
      wallet.push('accountsChanged', [
        {
          partyId: 'bob::9931cd',
          primary: true,
          hint: 'bob',
          publicKey: 'pub-bob',
          networkId: 'canton:local',
        },
      ])
    })

    await waitFor(() => expect(result.current.party.party?.partyId).toBe('bob::9931cd'))

    wallet.dispose()
  })

  it('retires the SDK a closed picker left mid-connect', async () => {
    const wallet = walletA()
    const popup = stubPopup()
    restoreOpen = stubOpen(popup)

    const { result } = renderSession(() => useSession(), { walletPicker: undefined })

    await strandOnClosedPicker(result, popup)

    // The replacement sdk re-restores, so the settled answer arrives a tick later.
    await waitFor(() => expect(result.current.status).toBe('disconnected'))

    wallet.dispose()
  })
})
