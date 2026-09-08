import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fromPromise } from 'xstate'
import { useConnectBridge } from '#src/CantonConnectProvider/useConnectBridge'
import type { AccountsInput } from '#src/machine/accountsActors'
import { accountsMachine, type WalletAccounts } from '#src/machine/accountsMachine'
import type { ConnectInput, InitInput } from '#src/machine/connectionActors'
import { connectionMachine, type WalletStatusUpdate } from '#src/machine/connectionMachine'
import { testParty } from '#src/testing/party'
import { pause } from '#src/testing/pause'
import { startConnection } from '#src/testing/startConnection'

const connection: WalletStatusUpdate['connection'] = { isConnected: true, isNetworkConnected: true }
const party = testParty('alice::1220ab')

const readingAccounts = (read: () => Promise<WalletAccounts>) =>
  accountsMachine.provide({
    actors: { readAccounts: fromPromise<WalletAccounts, AccountsInput>(read) },
  })

describe('useConnectBridge', () => {
  it('rejects when the wallet accounts cannot be read', async () => {
    const readFailed = new Error('wallet rpc unavailable')
    const machine = connectionMachine.provide({
      actors: {
        init: fromPromise<void, InitInput>(() => Promise.resolve()),
        connect: fromPromise<WalletStatusUpdate, ConnectInput>(() =>
          Promise.resolve({ connection }),
        ),
        accounts: readingAccounts(() => Promise.reject(readFailed)),
      },
    })
    const actor = startConnection(machine)

    const { result } = renderHook(() => useConnectBridge(actor))

    await act(async () => {
      await expect(result.current()).rejects.toBe(readFailed)
    })

    // the session survives a failed read; the machine keeps the cause for the consumer to read
    expect(actor.getSnapshot().matches({ session: 'authenticated' })).toBe(true)
    expect(actor.getSnapshot().context.lastConnectError).toBe(readFailed)

    actor.stop()
  })

  it('rejects with an Error when the account read fails with a JSON-RPC object', async () => {
    const rpcError = { code: -32000, message: 'wallet locked' }
    const machine = connectionMachine.provide({
      actors: {
        init: fromPromise<void, InitInput>(() => Promise.resolve()),
        connect: fromPromise<WalletStatusUpdate, ConnectInput>(() =>
          Promise.resolve({ connection }),
        ),
        accounts: readingAccounts(() => Promise.reject(rpcError)),
      },
    })
    const actor = startConnection(machine)

    const { result } = renderHook(() => useConnectBridge(actor))

    await act(async () => {
      await expect(result.current()).rejects.toMatchObject({
        message: 'wallet locked',
        cause: rpcError,
      })
      await expect(result.current()).rejects.toBeInstanceOf(Error)
    })

    // the machine keeps what the wallet sent; the classification is the bridge's
    expect(actor.getSnapshot().context.lastConnectError).toBe(rpcError)

    actor.stop()
  })

  it('rejects when the provider goes away mid-connect', async () => {
    const machine = connectionMachine.provide({
      actors: {
        init: fromPromise<void, InitInput>(() => Promise.resolve()),
        connect: fromPromise<WalletStatusUpdate, ConnectInput>(() => new Promise(() => {})),
      },
    })
    const actor = startConnection(machine)

    const { result } = renderHook(() => useConnectBridge(actor))

    await act(async () => {
      const attempt = result.current()

      actor.stop()

      // waitFor's own rejection: a promise left pending here is a caller waiting on a dead actor
      await expect(attempt).rejects.toThrow()
    })
  })

  it('resolves only once the party has landed', async () => {
    let landAccounts: ((accounts: WalletAccounts) => void) | undefined
    const machine = connectionMachine.provide({
      actors: {
        init: fromPromise<void, InitInput>(() => Promise.resolve()),
        connect: fromPromise<WalletStatusUpdate, ConnectInput>(() =>
          Promise.resolve({ connection }),
        ),
        accounts: readingAccounts(
          () =>
            new Promise((resolve) => {
              landAccounts = resolve
            }),
        ),
      },
    })
    const actor = startConnection(machine)

    const { result } = renderHook(() => useConnectBridge(actor))

    const settled = vi.fn()

    await act(async () => {
      void result.current().then(settled)
      await pause(0)
    })

    expect(actor.getSnapshot().matches({ session: 'authenticated' })).toBe(true)
    expect(settled).not.toHaveBeenCalled()

    await act(async () => {
      landAccounts?.({ party })
      await pause(0)
    })

    expect(settled).toHaveBeenCalledOnce()

    actor.stop()
  })
})
