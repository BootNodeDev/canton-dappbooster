// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { createActor, type EventObject, fromCallback, fromPromise, waitFor } from 'xstate'
import { PickerClosedError } from '#src/connectError'
import type { AccountsInput } from '#src/machine/accountsActors'
import { accountsMachine, type WalletAccounts } from '#src/machine/accountsMachine'
import {
  type ConnectInput,
  type DisconnectInput,
  type InitInput,
  type RestoreInput,
  connect as realConnect,
  init as realInit,
  type WalletEventsInput,
} from '#src/machine/connectionActors'
import {
  connectionMachine,
  toConnectionStatus,
  type WalletStatusUpdate,
} from '#src/machine/connectionMachine'
// Not the '#src/testing' barrel: it re-exports fakeSession, whose Lit-backed SDK import needs a
// DOM.
import { connectionInput } from '#src/testing/connectionInput'
import { pause } from '#src/testing/pause'

const connection: WalletStatusUpdate['connection'] = { isConnected: true, isNetworkConnected: true }
const party = { partyId: 'alice::1220ab', networkId: 'canton:local' }

// Provided wherever a recorded sequence walks through a session: the real read reaches an sdk
// double that never answers, which would park those sequences in `reading`.
const accounts = accountsMachine.provide({
  actors: {
    readAccounts: fromPromise<WalletAccounts, AccountsInput>(() => Promise.resolve({ party })),
  },
})
const unauthenticatedConnection = { ...connection, isConnected: false }

// `session.unauthenticated` is only reachable by locking an authenticated one: CIP-0103 ties
// `session` to `isConnected`, so no status read reports a session that is logged out.
const lockPush = {
  type: 'wallet.statusChanged',
  status: { connection: unauthenticatedConnection },
} as const
const unlockPush = { type: 'wallet.statusChanged', status: { connection } } as const

describe('connectionMachine', () => {
  const init = fromPromise<void, InitInput>(() => Promise.resolve())
  const disconnect = fromPromise<null, DisconnectInput>(() => Promise.resolve(null))
  const restore = fromPromise<WalletStatusUpdate, RestoreInput>(() =>
    Promise.resolve({ connection }),
  )
  const connect = fromPromise<WalletStatusUpdate, ConnectInput>(() =>
    Promise.resolve({ connection }),
  )
  const walletRejected = fromPromise<WalletStatusUpdate, ConnectInput>(() =>
    Promise.reject(new Error('wallet rejected')),
  )

  describe('boot and restore', () => {
    it('starts idle, with nothing attempted', () => {
      const actor = createActor(connectionMachine, { input: connectionInput() })

      actor.start()

      expect(actor.getSnapshot().matches('idle')).toBe(true)

      actor.stop()
    })

    it('moves to initializing on restore', () => {
      const actor = createActor(connectionMachine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'restore' })

      expect(actor.getSnapshot().matches('initializing')).toBe(true)

      actor.stop()
    })

    it('restores a logged-in session straight in', async () => {
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          init,
          restore,
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)

      expect(actor.getSnapshot().matches({ session: 'authenticated' })).toBe(true)

      actor.stop()
    })

    it('returns to disconnected when there is no session to restore', async () => {
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          init,
          restore: fromPromise<WalletStatusUpdate, RestoreInput>(() =>
            Promise.resolve({ connection: { isConnected: false, isNetworkConnected: false } }),
          ),
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)

      expect(actor.getSnapshot().matches('disconnected')).toBe(true)
      expect(actor.getSnapshot().context.lastConnectError).toBeUndefined()

      actor.stop()
    })

    it('returns to disconnected quietly when restore fails', async () => {
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          init,
          restore: fromPromise<WalletStatusUpdate, RestoreInput>(() =>
            Promise.reject('failed to restore session'),
          ),
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)

      expect(actor.getSnapshot().matches('disconnected')).toBe(true)
      expect(actor.getSnapshot().context.lastConnectError).toBeUndefined()

      actor.stop()
    })

    it('aborts the in-flight restore', async () => {
      const onAbort = vi.fn()
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          init,
          restore: fromPromise<WalletStatusUpdate, RestoreInput>(({ signal }) => {
            signal.addEventListener('abort', onAbort, { once: true })
            return new Promise(() => {})
          }),
          disconnect,
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)
      actor.send({ type: 'disconnect' })
      await pause(0)

      expect(actor.getSnapshot().matches('disconnected')).toBe(true)
      expect(onAbort).toHaveBeenCalledOnce()

      actor.stop()
    })

    it('abandons the restore when a connect is asked for mid-flight', async () => {
      const connectStarted = vi.fn()
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          init,
          restore: fromPromise<WalletStatusUpdate, RestoreInput>(() => new Promise(() => {})),
          connect: fromPromise<WalletStatusUpdate, ConnectInput>(() => {
            connectStarted()
            return Promise.resolve({ connection })
          }),
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)

      expect(actor.getSnapshot().matches('restoring')).toBe(true)

      actor.send({ type: 'connect' })
      await pause(0)

      expect(connectStarted).toHaveBeenCalledOnce()
      expect(actor.getSnapshot().matches({ session: { authenticated: 'ready' } })).toBe(true)

      actor.stop()
    })

    it('surfaces a failed init as a failure', async () => {
      const initFailed = new Error('init failed')
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          init: fromPromise<void, InitInput>(() => Promise.reject(initFailed)),
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)

      expect(actor.getSnapshot().matches('failure')).toBe(true)
      expect(actor.getSnapshot().context.lastConnectError).toBe(initFailed)

      actor.stop()
    })

    it('retries the init when restore is sent again', async () => {
      const init = vi.fn(() => Promise.resolve()).mockRejectedValueOnce(new Error('init failed'))
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          init: fromPromise<void, InitInput>(init),
          restore,
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)

      expect(actor.getSnapshot().matches('failure')).toBe(true)

      actor.send({ type: 'restore' })
      await pause(0)

      expect(actor.getSnapshot().matches({ session: 'authenticated' })).toBe(true)
      expect(init).toHaveBeenCalledTimes(2)

      actor.stop()
    })

    it('signals abort to the invoked init actor', async () => {
      const onAbort = vi.fn()
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          init: fromPromise<void, InitInput>(({ signal }) => {
            signal.addEventListener('abort', onAbort, { once: true })
            return new Promise(() => {})
          }),
          disconnect,
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'restore' })
      actor.send({ type: 'disconnect' })
      await pause(0)

      expect(actor.getSnapshot().matches('disconnected')).toBe(true)
      expect(onAbort).toHaveBeenCalledOnce()

      actor.stop()
    })

    it('reports idle before anything is attempted', () => {
      const actor = createActor(connectionMachine, { input: connectionInput() })

      actor.start()

      expect(toConnectionStatus(actor.getSnapshot())).toBe('idle')

      actor.stop()
    })

    it('reports idle while initializing', () => {
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          init,
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'restore' })

      expect(toConnectionStatus(actor.getSnapshot())).toBe('idle')

      actor.stop()
    })

    it('reports idle while restoring', async () => {
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          init,
          restore: fromPromise<WalletStatusUpdate, RestoreInput>(() => new Promise(() => {})),
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)

      expect(toConnectionStatus(actor.getSnapshot())).toBe('idle')

      actor.stop()
    })
  })

  describe('connect', () => {
    it('moves to connecting on connect', () => {
      const actor = createActor(connectionMachine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'connect' })

      expect(actor.getSnapshot().matches('connecting')).toBe(true)

      actor.stop()
    })

    it('lands in failure when connect throws', async () => {
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          connect: walletRejected,
        },
      })

      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'connect' })
      await pause(0)

      expect(actor.getSnapshot().matches('failure')).toBe(true)
      expect(actor.getSnapshot().context.lastConnectError).toEqual(new Error('wallet rejected'))

      actor.stop()
    })

    it('drops the previous error when retrying', async () => {
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          connect: walletRejected,
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'connect' })
      await pause(0)
      actor.send({ type: 'connect' })

      expect(actor.getSnapshot().context.lastConnectError).toBeUndefined()
      expect(actor.getSnapshot().matches('connecting')).toBe(true)

      actor.stop()
    })

    it('lands in failure when the wallet declines the connection', async () => {
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          connect: fromPromise<WalletStatusUpdate, ConnectInput>(() =>
            Promise.resolve({
              connection: {
                isConnected: false,
                isNetworkConnected: true,
                reason: 'user rejected',
              },
            }),
          ),
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'connect' })
      await pause(0)

      expect(actor.getSnapshot().matches('failure')).toBe(true)
      expect(actor.getSnapshot().context.lastConnectError).toEqual(new Error('user rejected'))

      actor.stop()
    })

    it('surfaces the network reason when decline carries only that', async () => {
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          connect: fromPromise<WalletStatusUpdate, ConnectInput>(() =>
            Promise.resolve({
              connection: {
                isConnected: false,
                isNetworkConnected: false,
                networkReason: 'network unreachable',
              },
            }),
          ),
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'connect' })
      await pause(0)

      expect(actor.getSnapshot().matches('failure')).toBe(true)
      expect(actor.getSnapshot().context.lastConnectError).toEqual(new Error('network unreachable'))

      actor.stop()
    })

    it('names the decline itself when the wallet gives neither reason', async () => {
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          connect: fromPromise<WalletStatusUpdate, ConnectInput>(() =>
            Promise.resolve({ connection: unauthenticatedConnection }),
          ),
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'connect' })
      await pause(0)

      expect(actor.getSnapshot().matches('failure')).toBe(true)
      expect(actor.getSnapshot().context.lastConnectError).toEqual(
        new Error('wallet declined connection'),
      )

      actor.stop()
    })

    it('ignores a re-entrant connect while connecting', () => {
      const actorStarted = vi.fn()
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          connect: fromPromise<WalletStatusUpdate, ConnectInput>(() => {
            actorStarted()
            return new Promise(() => {})
          }),
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'connect' })
      actor.send({ type: 'connect' })

      expect(actor.getSnapshot().matches('connecting')).toBe(true)
      expect(actorStarted).toHaveBeenCalledOnce()

      actor.stop()
    })

    it('aborts the in-flight attempt when the actor is stopped', () => {
      const onAbort = vi.fn()
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          init,
          connect: fromPromise<WalletStatusUpdate, ConnectInput>(({ signal }) => {
            signal.addEventListener('abort', onAbort, { once: true })
            return new Promise(() => {})
          }),
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'connect' })
      actor.stop()

      expect(onAbort).toHaveBeenCalledOnce()
    })

    it('drops a wallet answer that lands after the attempt was left', async () => {
      let landAnswer: ((update: WalletStatusUpdate) => void) | undefined
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          disconnect,
          connect: fromPromise<WalletStatusUpdate, ConnectInput>(
            () =>
              new Promise((resolve) => {
                landAnswer = resolve
              }),
          ),
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'connect' })
      actor.send({ type: 'disconnect' })

      // leaving `connecting` stops the connect actor, so what it settles with is never an event
      landAnswer?.({ connection })
      await pause(0)

      expect(actor.getSnapshot().matches('session')).toBe(false)
      expect(actor.getSnapshot().matches('disconnected')).toBe(true)

      actor.stop()
    })

    it('signals abort to the invoked connect actor', async () => {
      const onAbort = vi.fn()
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          connect: fromPromise<WalletStatusUpdate, ConnectInput>(({ signal }) => {
            signal.addEventListener('abort', onAbort, { once: true })
            return new Promise(() => {})
          }),
          disconnect,
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'connect' })
      actor.send({ type: 'disconnect' })
      await pause(0)

      expect(actor.getSnapshot().matches('disconnected')).toBe(true)
      expect(onAbort).toHaveBeenCalledOnce()

      actor.stop()
    })

    it('reports connecting while the wallet decides', () => {
      const actor = createActor(connectionMachine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'connect' })

      expect(toConnectionStatus(actor.getSnapshot())).toBe('connecting')

      actor.stop()
    })

    it('reports connected for a live session', async () => {
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          connect,
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'connect' })
      await pause(0)

      expect(toConnectionStatus(actor.getSnapshot())).toBe('connected')

      actor.stop()
    })

    it('reports disconnected after a failure', async () => {
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          connect: fromPromise<WalletStatusUpdate, ConnectInput>(() =>
            Promise.reject(new Error('picker exploded')),
          ),
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'connect' })
      await pause(0)

      expect(toConnectionStatus(actor.getSnapshot())).toBe('disconnected')

      actor.stop()
    })
  })

  describe('session and pushes', () => {
    it('is dropped by a lock, because a wallet that will not serve has no party to offer', async () => {
      const machine = connectionMachine.provide({
        actors: {
          init,
          accounts,
          restore,
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)

      expect(actor.getSnapshot().context.party).toEqual(party)

      actor.send(lockPush)

      expect(actor.getSnapshot().matches({ session: 'unauthenticated' })).toBe(true)
      expect(actor.getSnapshot().context.party).toBeUndefined()

      actor.stop()
    })

    it('is forgotten when the session ends', async () => {
      const machine = connectionMachine.provide({
        actors: {
          init,
          accounts,
          disconnect,
          restore,
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)

      expect(actor.getSnapshot().context.party).toEqual(party)

      actor.send({ type: 'disconnect' })
      await pause(0)

      expect(actor.getSnapshot().matches('disconnected')).toBe(true)
      expect(actor.getSnapshot().context.party).toBeUndefined()

      actor.stop()
    })

    // The decline itself, and the session recovered from it, are pinned at actor level by
    // connectionActors' 'recovers the live session when the wallet declines the connection'.
    it('keeps the live session over a reconnect, and never asks the wallet to disconnect', async () => {
      const sdkDisconnect = vi.fn(() => Promise.resolve(null))
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          init,
          restore,
          disconnect: fromPromise<null, DisconnectInput>(sdkDisconnect),
          // what the connect actor hands back over a live session: the status it read from the
          // wallet
          connect,
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)

      actor.send({ type: 'connect' })
      expect(actor.getSnapshot().matches('connecting')).toBe(true)

      await pause(0)

      expect(actor.getSnapshot().matches({ session: 'authenticated' })).toBe(true)
      // never asked to end the session, which is what makes an abandoned change recoverable
      expect(sdkDisconnect).not.toHaveBeenCalled()

      actor.stop()
    })

    it('starts listening when a session begins', async () => {
      const walletSubscribed = vi.fn()
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          init,
          restore,
          walletEvents: fromCallback<EventObject, WalletEventsInput>(() => {
            walletSubscribed()
          }),
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()

      expect(walletSubscribed).not.toHaveBeenCalled()

      actor.send({ type: 'restore' })
      await pause(0)

      expect(actor.getSnapshot().matches({ session: 'authenticated' })).toBe(true)
      expect(walletSubscribed).toHaveBeenCalledOnce()

      actor.stop()
    })

    it('reaches the machine upon wallet push', async () => {
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          init,
          restore,
          walletEvents: fromCallback<EventObject, WalletEventsInput>(({ sendBack }) => {
            sendBack(lockPush)
          }),
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)

      expect(actor.getSnapshot().matches({ session: 'unauthenticated' })).toBe(true)

      actor.stop()
    })

    it('stops listening when session ends', async () => {
      const walletUnsubscribed = vi.fn()
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          init,
          restore,
          walletEvents: fromCallback<EventObject, WalletEventsInput>(() => walletUnsubscribed),
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)

      expect(actor.getSnapshot().matches({ session: 'authenticated' })).toBe(true)
      expect(walletUnsubscribed).not.toHaveBeenCalled()

      actor.send({ type: 'disconnect' })

      expect(walletUnsubscribed).toHaveBeenCalledOnce()

      actor.stop()
    })

    it('keeps listening across login changes', async () => {
      const walletSubscribed = vi.fn()
      const walletUnsubscribed = vi.fn()
      let pushFromWallet: ((event: EventObject) => void) | undefined
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          init,
          restore,
          walletEvents: fromCallback<EventObject, WalletEventsInput>(({ sendBack }) => {
            walletSubscribed()
            pushFromWallet = sendBack
            return walletUnsubscribed
          }),
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)

      expect(walletSubscribed).toHaveBeenCalledOnce()

      actor.send(lockPush)

      expect(actor.getSnapshot().matches({ session: 'unauthenticated' })).toBe(true)
      expect(walletSubscribed).toHaveBeenCalledOnce()
      expect(walletUnsubscribed).not.toHaveBeenCalled()

      // Through the listener rather than the actor, so only a live subscription lands it.
      pushFromWallet?.(unlockPush)

      expect(actor.getSnapshot().matches({ session: 'authenticated' })).toBe(true)

      actor.stop()
    })

    it('rebinds the listener when a restore arrives on a standing session', async () => {
      const walletSubscribed = vi.fn()
      const walletUnsubscribed = vi.fn()
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          init,
          restore,
          walletEvents: fromCallback<EventObject, WalletEventsInput>(() => {
            walletSubscribed()
            return () => walletUnsubscribed()
          }),
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)

      expect(walletSubscribed).toHaveBeenCalledOnce()

      // What a replaced sdk triggers: the running listener is bound to the old client.
      actor.send({ type: 'restore' })
      await pause(0)

      expect(walletUnsubscribed).toHaveBeenCalledOnce()
      expect(walletSubscribed).toHaveBeenCalledTimes(2)
      expect(actor.getSnapshot().matches({ session: { authenticated: 'ready' } })).toBe(true)

      actor.stop()
    })
  })

  describe('lock', () => {
    it('makes a wallet logout visible immediately', async () => {
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          init,
          restore,
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)

      expect(actor.getSnapshot().matches({ session: 'authenticated' })).toBe(true)

      actor.send(lockPush)

      expect(actor.getSnapshot().matches({ session: 'unauthenticated' })).toBe(true)

      actor.stop()
    })

    it('makes a wallet login visible immediately', async () => {
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          init,
          restore,
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)
      actor.send(lockPush)

      expect(actor.getSnapshot().matches({ session: 'unauthenticated' })).toBe(true)

      actor.send({ type: 'wallet.statusChanged', status: { connection } })

      expect(actor.getSnapshot().matches({ session: 'authenticated' })).toBe(true)

      actor.stop()
    })

    it('stays authenticated when a push still says logged in', async () => {
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          init,
          restore,
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)

      expect(actor.getSnapshot().matches({ session: 'authenticated' })).toBe(true)

      const freshConnection: WalletStatusUpdate['connection'] = {
        isConnected: true,
        isNetworkConnected: false,
      }
      actor.send({ type: 'wallet.statusChanged', status: { connection: freshConnection } })

      expect(actor.getSnapshot().matches({ session: 'authenticated' })).toBe(true)

      actor.stop()
    })

    it('stays logged out when a push still says logged out', async () => {
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          init,
          restore,
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)
      actor.send(lockPush)

      expect(actor.getSnapshot().matches({ session: 'unauthenticated' })).toBe(true)

      actor.send(lockPush)

      expect(actor.getSnapshot().matches({ session: 'unauthenticated' })).toBe(true)

      actor.stop()
    })

    it('keeps the party when a push repeats a logged-in session', async () => {
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          init,
          restore,
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)

      expect(actor.getSnapshot().context.party).toEqual(party)

      actor.send({ type: 'wallet.statusChanged', status: { connection } })

      expect(actor.getSnapshot().matches({ session: 'authenticated' })).toBe(true)
      expect(actor.getSnapshot().context.party).toEqual(party)

      actor.stop()
    })

    it('reports connected for an unauthenticated session', async () => {
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          init,
          restore,
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)
      actor.send(lockPush)

      expect(actor.getSnapshot().matches({ session: 'unauthenticated' })).toBe(true)
      expect(toConnectionStatus(actor.getSnapshot())).toBe('connected')

      actor.stop()
    })
  })

  describe('disconnect', () => {
    it('asks the wallet even though the attempt never landed a session', async () => {
      const sdkDisconnect = vi.fn(() => Promise.resolve(null))
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          init,
          restore,
          connect: fromPromise<WalletStatusUpdate, ConnectInput>(() => new Promise(() => {})),
          disconnect: fromPromise<null, DisconnectInput>(sdkDisconnect),
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)

      // a reconnect over the live session, the wallet-change path
      actor.send({ type: 'connect' })
      actor.send({ type: 'disconnect' })
      await pause(0)

      expect(sdkDisconnect).toHaveBeenCalledOnce()
      expect(actor.getSnapshot().matches('disconnected')).toBe(true)

      actor.stop()
    })

    it('connects once the disconnect it landed on finishes', async () => {
      const connectStarted = vi.fn()
      let endDisconnect: (() => void) | undefined
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          init,
          restore,
          disconnect: fromPromise<null, DisconnectInput>(
            () =>
              new Promise((resolve) => {
                endDisconnect = () => resolve(null)
              }),
          ),
          connect: fromPromise<WalletStatusUpdate, ConnectInput>(() => {
            connectStarted()
            return Promise.resolve({ connection })
          }),
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)

      actor.send({ type: 'disconnect' })
      expect(actor.getSnapshot().matches('disconnecting')).toBe(true)

      // the switch-wallet gesture: a connect landing before the wallet answered the disconnect
      actor.send({ type: 'connect' })
      expect(connectStarted).not.toHaveBeenCalled()

      endDisconnect?.()
      await pause(0)

      expect(connectStarted).toHaveBeenCalledOnce()
      expect(actor.getSnapshot().matches({ session: 'authenticated' })).toBe(true)

      actor.stop()
    })

    it('does not abort a connect that already settled', async () => {
      const onAbort = vi.fn()
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          connect: fromPromise<WalletStatusUpdate, ConnectInput>(({ signal }) => {
            signal.addEventListener('abort', onAbort, { once: true })
            return Promise.resolve({ connection })
          }),
          disconnect,
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'connect' })
      await pause(0)
      actor.send({ type: 'disconnect' })

      expect(actor.getSnapshot().matches('disconnecting')).toBe(true)
      expect(onAbort).not.toHaveBeenCalled()

      actor.stop()
    })

    it('returns to disconnected even when the SDK disconnect fails', async () => {
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          connect,
          disconnect: fromPromise<null, DisconnectInput>(() =>
            Promise.reject(new Error('disconnect failed')),
          ),
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'connect' })
      await pause(0)

      actor.send({ type: 'disconnect' })
      await pause(0)

      expect(actor.getSnapshot().matches('disconnected')).toBe(true)

      actor.stop()
    })

    it('disconnects a locked session', async () => {
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          init,
          disconnect,
          restore,
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)
      actor.send(lockPush)

      expect(actor.getSnapshot().matches({ session: 'unauthenticated' })).toBe(true)

      actor.send({ type: 'disconnect' })
      await pause(0)

      expect(actor.getSnapshot().matches('disconnected')).toBe(true)

      actor.stop()
    })

    it('ends the SDK session on disconnect', async () => {
      // Captures input.sdk: a double that ignores its input cannot detect a broken invoke mapping.
      const askedSdk: unknown[] = []
      const sdkDisconnect = vi.fn(({ input }: { input: DisconnectInput }) => {
        askedSdk.push(input.sdk)
        return Promise.resolve(null)
      })
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          connect,
          disconnect: fromPromise<null, DisconnectInput>(sdkDisconnect),
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'connect' })
      await pause(0)

      actor.send({ type: 'disconnect' })
      await pause(0)

      expect(sdkDisconnect).toHaveBeenCalledOnce()
      expect(askedSdk[0]).toBe(actor.getSnapshot().context.sdk)
      expect(actor.getSnapshot().matches('disconnected')).toBe(true)

      actor.stop()
    })

    it('reports disconnected while disconnecting', async () => {
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          connect,
          disconnect,
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'connect' })
      await pause(0)

      actor.send({ type: 'disconnect' })

      expect(actor.getSnapshot().matches('disconnecting')).toBe(true)
      expect(toConnectionStatus(actor.getSnapshot())).toBe('disconnected')

      actor.stop()
    })

    it('resets from failure on disconnect', async () => {
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          connect: walletRejected,
          disconnect,
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'connect' })
      await pause(0)

      expect(actor.getSnapshot().context.lastConnectError).toEqual(new Error('wallet rejected'))
      expect(actor.getSnapshot().matches('failure')).toBe(true)

      actor.send({ type: 'disconnect' })
      await pause(0)

      expect(actor.getSnapshot().context.lastConnectError).toBeUndefined()
      expect(actor.getSnapshot().matches('disconnected')).toBe(true)

      actor.stop()
    })

    it('takes a disconnect while connecting rather than dropping it', () => {
      const actorStarted = vi.fn()
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          connect: fromPromise<WalletStatusUpdate, ConnectInput>(() => {
            actorStarted()
            return new Promise(() => {})
          }),
          disconnect,
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'connect' })
      actor.send({ type: 'disconnect' })

      expect(actor.getSnapshot().matches('disconnecting')).toBe(true)
      expect(actorStarted).toHaveBeenCalledOnce()

      actor.stop()
    })
  })

  // A picker the user walked out on leaves sdk.connect() running inside the instance, so that
  // instance is abandoned and the session re-derived on a fresh one.
  describe('retiring the stranded sdk', () => {
    const closedPicker = fromPromise<WalletStatusUpdate, ConnectInput>(() =>
      Promise.reject(new PickerClosedError()),
    )

    // One name per instance, so which of them the machine inits after the swap is visible.
    const namedSdks = () => {
      const names = ['stranded', 'replacement']
      const inited: string[] = []

      const createSdk = () => {
        const name = names.shift() ?? 'a third instance'

        return connectionInput({
          init: () => {
            inited.push(name)
            return Promise.resolve()
          },
        }).createSdk()
      }

      return { createSdk, inited }
    }

    it('answers the walked-out connect as a cancel, on a replaced sdk', async () => {
      const machine = connectionMachine.provide({ actors: { accounts, connect: closedPicker } })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      const stranded = actor.getSnapshot().context.sdk

      actor.send({ type: 'connect' })

      // What the bridge waits on, so this is the answer connect() rejects with.
      const settled = await waitFor(actor, (snapshot) => snapshot.hasTag('connect.cancelled'))

      expect(settled.matches('retiring')).toBe(true)
      expect(settled.hasTag('connect.failed')).toBe(false)
      // nothing failed, so nothing is left for a consumer to read
      expect(settled.context.lastConnectError).toBeUndefined()
      expect(settled.context.sdk).not.toBe(stranded)

      actor.stop()
    })

    it('inits the replacement, not the instance it just retired', async () => {
      const { createSdk, inited } = namedSdks()
      const machine = connectionMachine.provide({ actors: { accounts, connect: closedPicker } })
      const actor = createActor(machine, { input: connectionInput({}, { createSdk }) })

      actor.start()
      actor.send({ type: 'connect' })
      await pause(0)

      expect(inited).toEqual(['replacement'])

      actor.stop()
    })

    it('retires the instance a failed boot init poisoned', async () => {
      const bootFailed = new Error('adapter config rejected')
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          init: fromPromise<void, InitInput>(() => Promise.reject(bootFailed)),
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      const poisoned = actor.getSnapshot().context.sdk

      actor.send({ type: 'restore' })
      await pause(0)

      expect(actor.getSnapshot().matches('failure')).toBe(true)
      expect(actor.getSnapshot().context.lastConnectError).toBe(bootFailed)
      expect(actor.getSnapshot().context.sdk).not.toBe(poisoned)

      actor.stop()
    })

    it('a retry after a failed init runs on the replacement', async () => {
      const silenced = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      const inited: string[] = []
      const names = ['poisoned', 'replacement']

      const createSdk = () => {
        const name = names.shift() ?? 'a third instance'

        return connectionInput({
          init: () => {
            inited.push(name)
            return name === 'poisoned' ? Promise.reject(new Error('flaky boot')) : Promise.resolve()
          },
        }).createSdk()
      }

      const machine = connectionMachine.provide({ actors: { accounts, init: realInit } })
      const actor = createActor(machine, { input: connectionInput({}, { createSdk }) })

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)

      expect(actor.getSnapshot().matches('failure')).toBe(true)

      actor.send({ type: 'restore' })
      await pause(0)

      // the point of the retirement: the retry inits the replacement, not the cached rejection
      expect(inited).toEqual(['poisoned', 'replacement'])
      expect(actor.getSnapshot().matches('restoring')).toBe(true)

      silenced.mockRestore()
      actor.stop()
    })

    it('retires the instance when the connect-run init fails, and records the cause', async () => {
      const silenced = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      const bootFailed = new Error('adapter config rejected')
      const machine = connectionMachine.provide({ actors: { accounts, connect: realConnect } })
      const actor = createActor(machine, {
        input: connectionInput({ init: () => Promise.reject(bootFailed) }),
      })

      actor.start()
      const poisoned = actor.getSnapshot().context.sdk

      actor.send({ type: 'connect' })
      await pause(0)

      expect(actor.getSnapshot().matches('failure')).toBe(true)
      // the consumer reads the SDK's own error, not the routing wrapper
      expect(actor.getSnapshot().context.lastConnectError).toBe(bootFailed)
      expect(actor.getSnapshot().context.sdk).not.toBe(poisoned)

      silenced.mockRestore()
      actor.stop()
    })

    it('brings the session back on the replacement', async () => {
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          init,
          connect: closedPicker,
          restore,
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'connect' })
      await pause(0)

      expect(actor.getSnapshot().matches({ session: { authenticated: 'ready' } })).toBe(true)

      actor.stop()
    })

    it('takes a disconnect while the replacement is still booting', async () => {
      const machine = connectionMachine.provide({
        actors: { accounts, disconnect, connect: closedPicker },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'connect' })
      await pause(0)

      expect(actor.getSnapshot().matches('retiring')).toBe(true)

      actor.send({ type: 'disconnect' })
      await pause(0)

      expect(actor.getSnapshot().matches('disconnected')).toBe(true)

      actor.stop()
    })

    it('reports disconnected while the replacement boots, as a failure does', async () => {
      const machine = connectionMachine.provide({ actors: { accounts, connect: closedPicker } })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'connect' })
      await pause(0)

      expect(actor.getSnapshot().matches('retiring')).toBe(true)
      expect(toConnectionStatus(actor.getSnapshot())).toBe('disconnected')

      actor.stop()
    })

    it('takes a second connect while the replacement is still booting', async () => {
      const attemptedOn: ConnectInput['sdk'][] = []
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          connect: fromPromise<WalletStatusUpdate, ConnectInput>(({ input }) => {
            attemptedOn.push(input.sdk)
            return Promise.reject(new PickerClosedError())
          }),
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'connect' })
      await pause(0)

      const replacement = actor.getSnapshot().context.sdk

      actor.send({ type: 'connect' })

      expect(actor.getSnapshot().matches('connecting')).toBe(true)
      // the point of the retirement: the second attempt runs on the fresh instance
      expect(attemptedOn[1]).toBe(replacement)
      expect(attemptedOn[1]).not.toBe(attemptedOn[0])

      actor.stop()
    })

    it('fails when the replacement cannot boot either', async () => {
      const bootFailed = new Error('replacement init failed')
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          connect: closedPicker,
          init: fromPromise<void, InitInput>(() => Promise.reject(bootFailed)),
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'connect' })
      await pause(0)

      expect(actor.getSnapshot().matches('failure')).toBe(true)
      // the cancel `retiring` cleared is replaced by the boot failure, not left empty
      expect(actor.getSnapshot().context.lastConnectError).toBe(bootFailed)
      expect(actor.getSnapshot().hasTag('connect.failed')).toBe(true)

      actor.stop()
    })
  })

  describe('reset', () => {
    it('forgets the last failure on request', async () => {
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          connect: walletRejected,
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'connect' })
      await pause(0)

      expect(actor.getSnapshot().context.lastConnectError).toBeDefined()

      actor.send({ type: 'connectError.reset' })

      expect(actor.getSnapshot().context.lastConnectError).toBeUndefined()
      expect(actor.getSnapshot().matches('failure')).toBe(true)

      actor.stop()
    })
  })

  // The tags are the machine's answer to "has this operation finished": the bridges read nothing
  // else, so a state that answers must carry one.
  describe('tags', () => {
    it('says nothing has answered while an attempt runs', async () => {
      const machine = connectionMachine.provide({
        actors: {
          connect,
          accounts: accountsMachine.provide({
            actors: {
              readAccounts: fromPromise<WalletAccounts, AccountsInput>(() => new Promise(() => {})),
            },
          }),
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'connect' })

      expect(actor.getSnapshot().hasTag('connect.settled')).toBe(false)
      expect(actor.getSnapshot().hasTag('connect.failed')).toBe(false)

      await pause(0)

      expect(actor.getSnapshot().matches({ session: { authenticated: 'reading' } })).toBe(true)
      expect(actor.getSnapshot().hasTag('connect.settled')).toBe(false)
      expect(actor.getSnapshot().hasTag('connect.failed')).toBe(false)

      actor.stop()
    })

    it('says a connect is in flight from the attempt until the party lands', async () => {
      let landRead: ((accounts: WalletAccounts) => void) | undefined
      const machine = connectionMachine.provide({
        actors: {
          connect,
          accounts: accountsMachine.provide({
            actors: {
              readAccounts: fromPromise<WalletAccounts, AccountsInput>(
                () =>
                  new Promise((resolve) => {
                    landRead = resolve
                  }),
              ),
            },
          }),
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'connect' })

      expect(actor.getSnapshot().hasTag('connecting')).toBe(true)

      await pause(0)

      // the wallet has approved, but a consumer showing an idle face here would render a session
      // with no party
      expect(actor.getSnapshot().matches({ session: { authenticated: 'reading' } })).toBe(true)
      expect(actor.getSnapshot().hasTag('connecting')).toBe(true)

      landRead?.({ party })
      await pause(0)

      expect(actor.getSnapshot().matches({ session: { authenticated: 'ready' } })).toBe(true)
      expect(actor.getSnapshot().hasTag('connecting')).toBe(false)

      actor.stop()
    })

    it('says a session is locked while it is unauthenticated, and not once it unlocks', async () => {
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          connect,
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'connect' })
      await pause(0)

      expect(actor.getSnapshot().hasTag('unauthenticated')).toBe(false)

      actor.send(lockPush)

      expect(actor.getSnapshot().hasTag('unauthenticated')).toBe(true)

      actor.send({ type: 'wallet.statusChanged', status: { connection } })

      expect(actor.getSnapshot().hasTag('unauthenticated')).toBe(false)

      actor.stop()
    })

    it('settles a connect once the party has landed, and again when the wallet locks', async () => {
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          connect,
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'connect' })
      await pause(0)

      expect(actor.getSnapshot().hasTag('connect.settled')).toBe(true)

      actor.send(lockPush)

      expect(actor.getSnapshot().hasTag('connect.settled')).toBe(true)

      actor.stop()
    })

    it('fails a connect on a failed read, keeping the wallet error', async () => {
      const readFailed = new Error('wallet rpc unavailable')
      const machine = connectionMachine.provide({
        actors: {
          connect,
          accounts: accountsMachine.provide({
            actors: {
              readAccounts: fromPromise<WalletAccounts, AccountsInput>(() =>
                Promise.reject(readFailed),
              ),
            },
          }),
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'connect' })
      await pause(0)

      expect(actor.getSnapshot().hasTag('connect.failed')).toBe(true)
      expect(actor.getSnapshot().context.lastConnectError).toBe(readFailed)

      actor.stop()
    })

    it('fails a connect from failure, and cancels one that ends disconnected', async () => {
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          disconnect,
          connect: walletRejected,
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'connect' })
      await pause(0)

      expect(actor.getSnapshot().hasTag('connect.failed')).toBe(true)
      expect(actor.getSnapshot().hasTag('connect.cancelled')).toBe(false)

      actor.send({ type: 'disconnect' })
      await pause(0)

      expect(actor.getSnapshot().matches('disconnected')).toBe(true)
      expect(actor.getSnapshot().hasTag('connect.cancelled')).toBe(true)
      expect(actor.getSnapshot().context.lastConnectError).toBeUndefined()

      actor.stop()
    })

    it('answers a disconnect that a connect supersedes', async () => {
      let endDisconnect: (() => void) | undefined
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          connect,
          disconnect: fromPromise<null, DisconnectInput>(
            () =>
              new Promise((resolve) => {
                endDisconnect = () => resolve(null)
              }),
          ),
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()

      // nothing to disconnect: the event is dropped, so a caller must not be left waiting
      expect(actor.getSnapshot().hasTag('disconnect.settled')).toBe(true)

      actor.send({ type: 'connect' })
      actor.send({ type: 'disconnect' })

      expect(actor.getSnapshot().matches({ disconnecting: 'ending' })).toBe(true)
      expect(actor.getSnapshot().hasTag('disconnect.settled')).toBe(false)

      // a connect takes over: the machine will reach `connecting`, never `disconnected`, so the
      // disconnect is answered here without claiming the wallet replied
      actor.send({ type: 'connect' })

      expect(actor.getSnapshot().matches({ disconnecting: 'reconnecting' })).toBe(true)
      expect(actor.getSnapshot().hasTag('disconnect.settled')).toBe(false)
      expect(actor.getSnapshot().hasTag('disconnect.superseded')).toBe(true)

      endDisconnect?.()
      await pause(0)

      expect(actor.getSnapshot().matches({ session: 'authenticated' })).toBe(true)

      actor.stop()
    })

    it('un-queues the superseding connect when a disconnect is asked for again', async () => {
      let endDisconnect: (() => void) | undefined
      const machine = connectionMachine.provide({
        actors: {
          accounts,
          connect,
          disconnect: fromPromise<null, DisconnectInput>(
            () =>
              new Promise((resolve) => {
                endDisconnect = () => resolve(null)
              }),
          ),
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'connect' })
      actor.send({ type: 'disconnect' })
      actor.send({ type: 'connect' })

      expect(actor.getSnapshot().matches({ disconnecting: 'reconnecting' })).toBe(true)

      actor.send({ type: 'disconnect' })

      expect(actor.getSnapshot().matches({ disconnecting: 'ending' })).toBe(true)
      expect(actor.getSnapshot().hasTag('disconnect.superseded')).toBe(false)

      endDisconnect?.()
      await pause(0)

      // the un-queued connect is answered as a cancel, and the disconnect as settled
      expect(actor.getSnapshot().matches('disconnected')).toBe(true)
      expect(actor.getSnapshot().hasTag('connect.cancelled')).toBe(true)
      expect(actor.getSnapshot().hasTag('disconnect.settled')).toBe(true)

      actor.stop()
    })

    it('forgets a recorded failure when a push recovers the read', async () => {
      const readFailed = new Error('wallet rpc unavailable')
      const machine = connectionMachine.provide({
        actors: {
          connect,
          accounts: accountsMachine.provide({
            actors: {
              readAccounts: fromPromise<WalletAccounts, AccountsInput>(() =>
                Promise.reject(readFailed),
              ),
            },
          }),
        },
      })
      const actor = createActor(machine, { input: connectionInput() })

      actor.start()
      actor.send({ type: 'connect' })
      await pause(0)

      expect(actor.getSnapshot().context.lastConnectError).toBe(readFailed)

      actor.getSnapshot().children.accounts?.send({ type: 'accounts.changed', accounts: { party } })
      await pause(0)

      expect(actor.getSnapshot().matches({ session: { authenticated: 'ready' } })).toBe(true)
      expect(actor.getSnapshot().context.party).toEqual(party)
      // a party and an error together read as a broken session
      expect(actor.getSnapshot().context.lastConnectError).toBeUndefined()

      actor.stop()
    })
  })
})
