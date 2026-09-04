// Wallet pushes reaching the hooks, and the two moments they must stop: disconnect and unmount.

import { act, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useConnect } from '#src/hooks/useConnect'
import { useDisconnect } from '#src/hooks/useDisconnect'
import { useExecute } from '#src/hooks/useExecute'
import { useParty } from '#src/hooks/useParty'
import { clearDiscoveryStorage } from '#src/testing/discoveryStorage'
import { renderSession } from '#src/testing/renderSession'
import { useSession } from '#src/testing/useSession'
import { walletA } from '#src/testing/walletA'

describe('CantonConnectProvider wallet pushes', () => {
  afterEach(() => {
    clearDiscoveryStorage()
    vi.restoreAllMocks()
  })

  it('delivers a pushed accountsChanged event to useParty()', async () => {
    const wallet = walletA()

    const { result } = renderSession(() => ({ connect: useConnect(), party: useParty() }))

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
    expect(result.current.party.party?.name).toBe('bob')

    wallet.dispose()
  })

  it('keeps execute stable when a push changes the party object but not its id', async () => {
    const wallet = walletA()

    const { result } = renderSession(() => ({
      connect: useConnect(),
      party: useParty(),
      execute: useExecute(),
    }))

    await act(async () => {
      await result.current.connect.connect()
    })

    await waitFor(() => expect(result.current.party.party?.partyId).toBe('alice::1220ab'))

    const before = result.current.execute.execute

    act(() => {
      wallet.push('accountsChanged', [
        {
          partyId: 'alice::1220ab',
          primary: true,
          hint: 'alice renamed',
          publicKey: 'pub-alice',
          networkId: 'canton:local',
        },
      ])
    })

    await waitFor(() => expect(result.current.party.party?.name).toBe('alice renamed'))
    expect(result.current.execute.execute).toBe(before)

    wallet.dispose()
  })

  it('advances useExecute().lastTx through a pending then executed txChanged push', async () => {
    const wallet = walletA()

    const { result } = renderSession(() => ({ connect: useConnect(), execute: useExecute() }))

    await act(async () => {
      await result.current.connect.connect()
    })

    act(() => {
      wallet.push('txChanged', { status: 'pending', commandId: 'cmd-1' })
    })

    await waitFor(() => expect(result.current.execute.lastTx?.status).toBe('pending'))
    expect(result.current.execute.lastTx?.payload).toBe(undefined)

    act(() => {
      wallet.push('txChanged', {
        status: 'executed',
        commandId: 'cmd-1',
        payload: { updateId: 'update-1', completionOffset: 42 },
      })
    })

    await waitFor(() => expect(result.current.execute.lastTx?.status).toBe('executed'))
    expect(result.current.execute.lastTx?.payload).toEqual({
      updateId: 'update-1',
      completionOffset: 42,
    })

    wallet.dispose()
  })

  it('stops applying pushed events to the hooks after disconnect()', async () => {
    const wallet = walletA()

    const { result } = renderSession(() => ({
      connect: useConnect(),
      disconnect: useDisconnect(),
      party: useParty(),
      execute: useExecute(),
    }))

    await act(async () => {
      await result.current.connect.connect()
    })

    await waitFor(() => expect(result.current.party.party?.partyId).toBe('alice::1220ab'))

    act(() => {
      wallet.push('txChanged', { status: 'pending', commandId: 'cmd-1' })
    })

    await waitFor(() => expect(result.current.execute.lastTx?.status).toBe('pending'))

    await act(async () => {
      await result.current.disconnect.disconnect()
    })

    expect(result.current.party.party).toBe(undefined)
    expect(result.current.execute.lastTx).toBe(undefined)

    act(() => {
      wallet.push('accountsChanged', [
        {
          partyId: 'carol::deadbeef',
          primary: true,
          hint: 'carol',
          publicKey: 'pub-carol',
          networkId: 'canton:local',
        },
      ])
      wallet.push('txChanged', { status: 'executed', commandId: 'cmd-2' })
    })

    // waitFor exhausts its retry window trying to observe the change; rejecting proves it never
    // arrived.
    await expect(
      waitFor(() => expect(result.current.party.party?.partyId).toBe('carol::deadbeef')),
    ).rejects.toThrow()

    expect(result.current.party.party).toBe(undefined)
    // The tx push had the same retry window to arrive in.
    expect(result.current.execute.lastTx).toBe(undefined)

    wallet.dispose()
  })

  it('tears down listeners when the provider unmounts', async () => {
    const wallet = walletA()

    // useExecute rides along for the tx listener; it is the only hook that registers one.
    const { result, unmount } = renderSession(() => ({
      session: useSession(),
      execute: useExecute(),
    }))

    await act(async () => {
      await result.current.session.connect()
    })

    const { sdk } = result.current.session
    const removeAccounts = vi.spyOn(sdk, 'removeOnAccountsChanged')
    const removeStatus = vi.spyOn(sdk, 'removeOnStatusChanged')
    const removeTx = vi.spyOn(sdk, 'removeOnTxChanged')

    unmount()

    expect(removeAccounts).toHaveBeenCalledTimes(1)
    expect(removeStatus).toHaveBeenCalledTimes(1)
    expect(removeTx).toHaveBeenCalledTimes(1)

    wallet.dispose()
  })
})
