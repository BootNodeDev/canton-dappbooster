import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fromPromise } from 'xstate'
import { useConnectBridge } from '#src/CantonConnectProvider/useConnectBridge'
import { useDisconnectBridge } from '#src/CantonConnectProvider/useDisconnectBridge'
import type { AccountsInput } from '#src/machine/accountsActors'
import { accountsMachine, type WalletAccounts } from '#src/machine/accountsMachine'
import type {
  ConnectInput,
  DisconnectInput,
  InitInput,
  RestoreInput,
} from '#src/machine/connectionActors'
import { connectionMachine, type WalletStatusUpdate } from '#src/machine/connectionMachine'
import { pause } from '#src/testing/pause'
import { startConnection } from '#src/testing/startConnection'

const connection: WalletStatusUpdate['connection'] = { isConnected: true, isNetworkConnected: true }
const party = { partyId: 'alice::1220ab', networkId: 'canton:local' }

const accounts = accountsMachine.provide({
  actors: {
    readAccounts: fromPromise<WalletAccounts, AccountsInput>(() => Promise.resolve({ party })),
  },
})

describe('useDisconnectBridge', () => {
  it('settles once the wallet has answered the disconnect', async () => {
    const sdkDisconnect = vi.fn(() => Promise.resolve(null))
    const machine = connectionMachine.provide({
      actors: {
        init: fromPromise<void, InitInput>(() => Promise.resolve()),
        restore: fromPromise<WalletStatusUpdate, RestoreInput>(() =>
          Promise.resolve({ connection }),
        ),
        disconnect: fromPromise<null, DisconnectInput>(sdkDisconnect),
        accounts,
      },
    })
    const actor = startConnection(machine)

    actor.send({ type: 'restore' })
    await pause(0)

    const { result } = renderHook(() => useDisconnectBridge(actor))

    const disconnected = vi.fn()

    await act(async () => {
      void result.current().then(disconnected)
      await pause(0)
    })

    expect(disconnected).toHaveBeenCalledOnce()
    expect(sdkDisconnect).toHaveBeenCalledOnce()
    expect(actor.getSnapshot().matches('disconnected')).toBe(true)
    expect(actor.getSnapshot().hasTag('disconnect.settled')).toBe(true)

    actor.stop()
  })

  it('settles a disconnect from idle without asking the wallet', async () => {
    const sdkDisconnect = vi.fn(() => Promise.resolve(null))
    const machine = connectionMachine.provide({
      actors: { disconnect: fromPromise<null, DisconnectInput>(sdkDisconnect), accounts },
    })
    const actor = startConnection(machine)

    const { result } = renderHook(() => useDisconnectBridge(actor))

    // A macrotask against the tag `idle` already carries: a settle needing an actor loses the race.
    const outcome = await Promise.race([
      result.current().then(() => 'settled' as const),
      pause(0).then(() => 'pending' as const),
    ])

    expect(outcome).toBe('settled')
    expect(sdkDisconnect).not.toHaveBeenCalled()
    expect(actor.getSnapshot().matches('idle')).toBe(true)

    actor.stop()
  })

  it('ignores a connect asked for during a disconnect, and settles the disconnect', async () => {
    const connectStarted = vi.fn()
    let endDisconnect: (() => void) | undefined
    const machine = connectionMachine.provide({
      actors: {
        init: fromPromise<void, InitInput>(() => Promise.resolve()),
        restore: fromPromise<WalletStatusUpdate, RestoreInput>(() =>
          Promise.resolve({ connection }),
        ),
        connect: fromPromise<WalletStatusUpdate, ConnectInput>(() => {
          connectStarted()
          return Promise.resolve({ connection })
        }),
        disconnect: fromPromise<null, DisconnectInput>(
          () =>
            new Promise((resolve) => {
              endDisconnect = () => resolve(null)
            }),
        ),
        accounts,
      },
    })
    const actor = startConnection(machine)

    actor.send({ type: 'restore' })
    await pause(0)

    const { result } = renderHook(() => ({
      connect: useConnectBridge(actor),
      disconnect: useDisconnectBridge(actor),
    }))

    const disconnected = vi.fn()
    const rejected = vi.fn()

    await act(async () => {
      void result.current.disconnect().then(disconnected)
      await pause(0)

      // a connect during the disconnect is ignored, not queued: the connect actor never runs, and
      // the call rejects as cancelled once the machine rests in `disconnected`
      void result.current.connect().catch(rejected)
      endDisconnect?.()
      await pause(0)
    })

    expect(disconnected).toHaveBeenCalledOnce()
    expect(rejected).toHaveBeenCalledOnce()
    expect(connectStarted).not.toHaveBeenCalled()
    expect(actor.getSnapshot().matches('disconnected')).toBe(true)

    actor.stop()
  })
})
