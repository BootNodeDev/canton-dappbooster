// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { createActor, fromCallback, fromPromise, type StateValueFrom } from 'xstate'
import {
  connectionMachine,
  toConnectionStatus,
  type WalletStatusUpdate,
} from '#src/connectionMachine'
// Not the '#src/testing' barrel: it re-exports fakeSession, whose Lit-backed SDK import needs a
// DOM.
import { pause } from '#src/testing/pause'

const recordStates = (actor: ReturnType<typeof createActor<typeof connectionMachine>>) => {
  const states: StateValueFrom<typeof connectionMachine>[] = []

  actor.subscribe(({ value }) => states.push(value))

  return states
}

const connection: WalletStatusUpdate['connection'] = { isConnected: true, isNetworkConnected: true }
const unauthenticatedConnection = { ...connection, isConnected: false }
const session: WalletStatusUpdate['session'] = { accessToken: 'token', userId: 'user' }

describe('connectionMachine', () => {
  const init = fromPromise(() => Promise.resolve())

  it('starts disconnected', () => {
    const actor = createActor(connectionMachine)

    actor.start()

    expect(actor.getSnapshot().matches('disconnected')).toBe(true)

    actor.stop()
  })

  describe('connect attempt', () => {
    it('moves to connecting on connect', () => {
      const actor = createActor(connectionMachine)

      actor.start()
      actor.send({ type: 'connect' })

      expect(actor.getSnapshot().matches('connecting')).toBe(true)

      actor.stop()
    })

    it('stores the connect result in context', async () => {
      const machine = connectionMachine.provide({
        actors: {
          connect: fromPromise(() => Promise.resolve({ connection })),
        },
      })
      const actor = createActor(machine)

      actor.start()
      actor.send({ type: 'connect' })
      await pause(0)

      expect(actor.getSnapshot().matches({ session: 'authenticated' })).toBe(true)
      expect(actor.getSnapshot().context.connection).toBe(connection)

      actor.stop()
    })

    it('lands recovered sessions in context', async () => {
      const machine = connectionMachine.provide({
        actors: {
          connect: fromPromise<WalletStatusUpdate>(() => Promise.resolve({ connection, session })),
        },
      })
      const actor = createActor(machine)

      actor.start()
      actor.send({ type: 'connect' })
      await pause(0)

      expect(actor.getSnapshot().matches({ session: 'authenticated' })).toBe(true)
      expect(actor.getSnapshot().context.session).toBe(session)

      actor.stop()
    })
  })

  describe('cancel', () => {
    it('cancel signals abort to the invoked init actor', () => {
      const onAbort = vi.fn()
      const machine = connectionMachine.provide({
        actors: {
          init: fromPromise(({ signal }) => {
            signal.addEventListener('abort', onAbort, { once: true })
            return new Promise(() => {})
          }),
        },
      })
      const actor = createActor(machine)
      const states = recordStates(actor)

      actor.start()
      actor.send({ type: 'restore' })
      actor.send({ type: 'cancel' })

      expect(states).toEqual<typeof states>(['disconnected', 'initializing', 'disconnected'])
      expect(onAbort).toHaveBeenCalledOnce()

      actor.stop()
    })

    it('cancel signals abort to the invoked connect actor', () => {
      const onAbort = vi.fn()
      const machine = connectionMachine.provide({
        actors: {
          connect: fromPromise(({ signal }) => {
            signal.addEventListener('abort', onAbort, { once: true })
            return new Promise(() => {})
          }),
        },
      })
      const actor = createActor(machine)

      actor.start()
      actor.send({ type: 'connect' })
      actor.send({ type: 'cancel' })

      expect(actor.getSnapshot().matches('disconnected')).toBe(true)
      expect(onAbort).toHaveBeenCalledOnce()

      actor.stop()
    })

    it('is ignored once the connection settled', async () => {
      const onAbort = vi.fn()
      const machine = connectionMachine.provide({
        actors: {
          connect: fromPromise(({ signal }) => {
            signal.addEventListener('abort', onAbort, { once: true })
            return Promise.resolve({ connection })
          }),
        },
      })
      const actor = createActor(machine)

      actor.start()
      actor.send({ type: 'connect' })
      await pause(0)
      actor.send({ type: 'cancel' })

      expect(actor.getSnapshot().matches({ session: 'authenticated' })).toBe(true)
      expect(onAbort).not.toHaveBeenCalled()

      actor.stop()
    })
  })

  describe('failure', () => {
    it('lands in failure when connect throws', async () => {
      const machine = connectionMachine.provide({
        actors: {
          connect: fromPromise(() => Promise.reject(new Error('wallet rejected'))),
        },
      })

      const actor = createActor(machine)

      actor.start()
      actor.send({ type: 'connect' })
      await pause(0)

      expect(actor.getSnapshot().matches('failure')).toBe(true)
      expect(actor.getSnapshot().context.error).toEqual(new Error('wallet rejected'))

      actor.stop()
    })

    it('drops the previous error when retrying', async () => {
      const machine = connectionMachine.provide({
        actors: {
          connect: fromPromise(() => Promise.reject(new Error('wallet rejected'))),
        },
      })
      const actor = createActor(machine)
      const states = recordStates(actor)

      actor.start()
      actor.send({ type: 'connect' })
      await pause(0)
      actor.send({ type: 'connect' })

      expect(actor.getSnapshot().context.error).toBeUndefined()
      expect(states).toEqual<typeof states>(['disconnected', 'connecting', 'failure', 'connecting'])

      actor.stop()
    })

    it('lands in failure when the wallet declines the connection', async () => {
      const machine = connectionMachine.provide({
        actors: {
          connect: fromPromise<WalletStatusUpdate>(() =>
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
      const actor = createActor(machine)
      const states = recordStates(actor)

      actor.start()
      actor.send({ type: 'connect' })
      await pause(0)

      expect(states).toEqual<typeof states>(['disconnected', 'connecting', 'failure'])
      expect(actor.getSnapshot().context.error).toEqual(new Error('user rejected'))
      expect(actor.getSnapshot().context.connection).toBeUndefined()

      actor.stop()
    })

    it('retries the init when restore is sent again', async () => {
      const init = vi.fn(() => Promise.resolve()).mockRejectedValueOnce(new Error('init failed'))
      const machine = connectionMachine.provide({
        actors: {
          init: fromPromise(init),
          restore: fromPromise<WalletStatusUpdate>(() => Promise.resolve({ connection, session })),
        },
      })
      const actor = createActor(machine)

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
  })

  describe('disconnect', () => {
    it('returns to disconnected', async () => {
      const machine = connectionMachine.provide({
        actors: {
          connect: fromPromise(() => Promise.resolve({ connection })),
        },
      })
      const actor = createActor(machine)
      const states = recordStates(actor)

      actor.start()
      actor.send({ type: 'connect' })
      await pause(0)

      actor.send({ type: 'disconnect' })

      expect(states).toEqual<typeof states>([
        'disconnected',
        'connecting',
        { session: 'authenticated' },
        'disconnected',
      ])

      actor.stop()
    })

    it('drops the connection information', async () => {
      const machine = connectionMachine.provide({
        actors: {
          connect: fromPromise(() => Promise.resolve({ connection })),
        },
      })
      const actor = createActor(machine)

      actor.start()
      actor.send({ type: 'connect' })
      await pause(0)
      expect(actor.getSnapshot().context.connection).toBe(connection)

      actor.send({ type: 'disconnect' })
      expect(actor.getSnapshot().context.connection).toBeUndefined()

      actor.stop()
    })

    it('drops the session data on disconnect', async () => {
      const machine = connectionMachine.provide({
        actors: {
          init,
          restore: fromPromise<WalletStatusUpdate>(() => Promise.resolve({ connection, session })),
        },
      })
      const actor = createActor(machine)
      const states = recordStates(actor)

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)
      expect(actor.getSnapshot().context.session).toBe(session)

      actor.send({ type: 'disconnect' })

      expect(actor.getSnapshot().context.connection).toBeUndefined()
      expect(actor.getSnapshot().context.session).toBeUndefined()
      expect(states).toEqual<typeof states>([
        'disconnected',
        'initializing',
        'restoring',
        { session: 'authenticated' },
        'disconnected',
      ])

      actor.stop()
    })

    it('drops the session data on disconnect from a logged-out session', async () => {
      const machine = connectionMachine.provide({
        actors: {
          init,
          restore: fromPromise<WalletStatusUpdate>(() =>
            Promise.resolve({ connection: unauthenticatedConnection, session }),
          ),
        },
      })
      const actor = createActor(machine)
      const states = recordStates(actor)

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)
      expect(actor.getSnapshot().context.session).toBe(session)
      expect(actor.getSnapshot().context.connection).toBeUndefined()

      actor.send({ type: 'disconnect' })

      expect(actor.getSnapshot().context.session).toBeUndefined()
      expect(states).toEqual<typeof states>([
        'disconnected',
        'initializing',
        'restoring',
        { session: 'unauthenticated' },
        'disconnected',
      ])

      actor.stop()
    })
  })

  describe('session restore', () => {
    it('moves to initializing on restore', () => {
      const actor = createActor(connectionMachine)

      actor.start()
      actor.send({ type: 'restore' })

      expect(actor.getSnapshot().matches('initializing')).toBe(true)

      actor.stop()
    })

    it('restores a logged-in session straight in', async () => {
      const machine = connectionMachine.provide({
        actors: {
          init,
          restore: fromPromise(() => Promise.resolve({ connection })),
        },
      })
      const actor = createActor(machine)

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)

      expect(actor.getSnapshot().matches({ session: 'authenticated' })).toBe(true)
      expect(actor.getSnapshot().context.connection).toBe(connection)

      actor.stop()
    })

    it('returns to disconnected when there is no session to restore', async () => {
      const machine = connectionMachine.provide({
        actors: {
          init,
          restore: fromPromise<WalletStatusUpdate>(() =>
            Promise.resolve({ connection: { isConnected: false, isNetworkConnected: false } }),
          ),
        },
      })
      const actor = createActor(machine)
      const states = recordStates(actor)

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)

      expect(states).toEqual<typeof states>([
        'disconnected',
        'initializing',
        'restoring',
        'disconnected',
      ])
      expect(actor.getSnapshot().context.connection).toBeUndefined()
      expect(actor.getSnapshot().context.error).toBeUndefined()

      actor.stop()
    })

    it('returns to disconnected quietly when restore fails', async () => {
      const machine = connectionMachine.provide({
        actors: {
          init,
          restore: fromPromise(() => Promise.reject('failed to restore session')),
        },
      })
      const actor = createActor(machine)
      const states = recordStates(actor)

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)

      expect(states).toEqual<typeof states>([
        'disconnected',
        'initializing',
        'restoring',
        'disconnected',
      ])
      expect(actor.getSnapshot().context.connection).toBeUndefined()
      expect(actor.getSnapshot().context.error).toBeUndefined()

      actor.stop()
    })

    it('aborts the in-flight restore', async () => {
      const onAbort = vi.fn()
      const machine = connectionMachine.provide({
        actors: {
          init,
          restore: fromPromise(({ signal }) => {
            signal.addEventListener('abort', onAbort, { once: true })
            return new Promise(() => {})
          }),
        },
      })
      const actor = createActor(machine)
      const states = recordStates(actor)

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)
      actor.send({ type: 'cancel' })

      expect(states).toEqual<typeof states>([
        'disconnected',
        'initializing',
        'restoring',
        'disconnected',
      ])
      expect(onAbort).toHaveBeenCalledOnce()

      actor.stop()
    })

    it('keeps a logged-out session, waiting for login', async () => {
      const machine = connectionMachine.provide({
        actors: {
          init,
          restore: fromPromise<WalletStatusUpdate>(() =>
            Promise.resolve({
              connection: { isConnected: false, isNetworkConnected: true },
              session,
            }),
          ),
        },
      })
      const actor = createActor(machine)

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)

      expect(actor.getSnapshot().context.session).toBe(session)
      expect(actor.getSnapshot().matches({ session: 'unauthenticated' })).toBe(true)

      actor.stop()
    })

    it('surfaces a failed init as a failure', async () => {
      const initFailed = new Error('init failed')
      const machine = connectionMachine.provide({
        actors: {
          init: fromPromise(() => Promise.reject(initFailed)),
        },
      })
      const actor = createActor(machine)

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)

      expect(actor.getSnapshot().matches('failure')).toBe(true)
      expect(actor.getSnapshot().context.error).toBe(initFailed)

      actor.stop()
    })
  })

  describe('races', () => {
    it('ignores a re-entrant connect while connecting', () => {
      const actorStarted = vi.fn()
      const machine = connectionMachine.provide({
        actors: {
          connect: fromPromise(() => {
            actorStarted()
            return new Promise(() => {})
          }),
        },
      })
      const actor = createActor(machine)

      actor.start()
      actor.send({ type: 'connect' })
      actor.send({ type: 'connect' })

      expect(actor.getSnapshot().matches('connecting')).toBe(true)
      expect(actorStarted).toHaveBeenCalledOnce()

      actor.stop()
    })

    it('ignores a disconnect while connecting', () => {
      const actorStarted = vi.fn()
      const machine = connectionMachine.provide({
        actors: {
          connect: fromPromise(() => {
            actorStarted()
            return new Promise(() => {})
          }),
        },
      })
      const actor = createActor(machine)

      actor.start()
      actor.send({ type: 'connect' })
      actor.send({ type: 'disconnect' })

      expect(actor.getSnapshot().matches('connecting')).toBe(true)
      expect(actorStarted).toHaveBeenCalledOnce()

      actor.stop()
    })

    it('aborts the in-flight attempt when the actor is stopped', () => {
      const onAbort = vi.fn()
      const machine = connectionMachine.provide({
        actors: {
          init,
          connect: fromPromise(({ signal }) => {
            signal.addEventListener('abort', onAbort, { once: true })
            return new Promise(() => {})
          }),
        },
      })
      const actor = createActor(machine)

      actor.start()
      actor.send({ type: 'connect' })
      actor.stop()

      expect(onAbort).toHaveBeenCalledOnce()
    })
  })

  describe('wallet pushes', () => {
    it('makes a wallet logout visible immediately', async () => {
      const machine = connectionMachine.provide({
        actors: {
          init,
          restore: fromPromise<WalletStatusUpdate>(() => Promise.resolve({ connection, session })),
        },
      })
      const actor = createActor(machine)

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)

      expect(actor.getSnapshot().matches({ session: 'authenticated' })).toBe(true)

      actor.send({
        type: 'wallet.statusChanged',
        status: {
          connection: unauthenticatedConnection,
          session: { ...session, accessToken: 'stale-token' },
        },
      })

      expect(actor.getSnapshot().matches({ session: 'unauthenticated' })).toBe(true)
      expect(actor.getSnapshot().context.session).toBe(session)
      expect(actor.getSnapshot().context.connection).toBeUndefined()

      actor.stop()
    })

    it('makes a wallet login visible immediately', async () => {
      const machine = connectionMachine.provide({
        actors: {
          init,
          restore: fromPromise<WalletStatusUpdate>(() =>
            Promise.resolve({ connection: unauthenticatedConnection, session }),
          ),
        },
      })
      const actor = createActor(machine)

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)

      expect(actor.getSnapshot().matches({ session: 'unauthenticated' })).toBe(true)
      expect(actor.getSnapshot().context.session).toBe(session)

      const freshSession: WalletStatusUpdate['session'] = {
        accessToken: 'fresh-token',
        userId: 'user',
      }
      actor.send({ type: 'wallet.statusChanged', status: { connection, session: freshSession } })

      expect(actor.getSnapshot().matches({ session: 'authenticated' })).toBe(true)
      expect(actor.getSnapshot().context.connection).toBe(connection)
      expect(actor.getSnapshot().context.session).toBe(freshSession)

      actor.stop()
    })

    it('stays authenticated when a push still says logged in', async () => {
      const machine = connectionMachine.provide({
        actors: {
          init,
          restore: fromPromise<WalletStatusUpdate>(() => Promise.resolve({ connection, session })),
        },
      })
      const actor = createActor(machine)

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)

      expect(actor.getSnapshot().matches({ session: 'authenticated' })).toBe(true)

      const freshConnection: WalletStatusUpdate['connection'] = {
        isConnected: true,
        isNetworkConnected: false,
      }
      const freshSession: WalletStatusUpdate['session'] = {
        accessToken: 'fresh-token',
        userId: 'user',
      }
      actor.send({
        type: 'wallet.statusChanged',
        status: { connection: freshConnection, session: freshSession },
      })

      expect(actor.getSnapshot().matches({ session: 'authenticated' })).toBe(true)
      expect(actor.getSnapshot().context.connection).toBe(freshConnection)
      expect(actor.getSnapshot().context.session).toBe(freshSession)

      actor.stop()
    })

    it('stays logged out when a push still says logged out', async () => {
      const machine = connectionMachine.provide({
        actors: {
          init,
          restore: fromPromise<WalletStatusUpdate>(() =>
            Promise.resolve({ connection: unauthenticatedConnection, session }),
          ),
        },
      })
      const actor = createActor(machine)

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)

      expect(actor.getSnapshot().matches({ session: 'unauthenticated' })).toBe(true)
      expect(actor.getSnapshot().context.session).toBe(session)

      actor.send({
        type: 'wallet.statusChanged',
        status: { connection: unauthenticatedConnection },
      })

      expect(actor.getSnapshot().matches({ session: 'unauthenticated' })).toBe(true)
      expect(actor.getSnapshot().context.session).toBe(session)
      expect(actor.getSnapshot().context.connection).toBeUndefined()

      actor.stop()
    })

    it('keeps the stored session when a push carries none', async () => {
      const machine = connectionMachine.provide({
        actors: {
          init,
          restore: fromPromise<WalletStatusUpdate>(() => Promise.resolve({ connection, session })),
        },
      })
      const actor = createActor(machine)

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)

      expect(actor.getSnapshot().matches({ session: 'authenticated' })).toBe(true)
      expect(actor.getSnapshot().context.session).toBe(session)

      actor.send({ type: 'wallet.statusChanged', status: { connection } })

      expect(actor.getSnapshot().matches({ session: 'authenticated' })).toBe(true)
      expect(actor.getSnapshot().context.session).toBe(session)

      actor.stop()
    })
  })

  describe('wallet events listener', () => {
    it('starts listening when a session begins', async () => {
      const walletSubscribed = vi.fn()
      const machine = connectionMachine.provide({
        actors: {
          init,
          restore: fromPromise<WalletStatusUpdate>(() => Promise.resolve({ connection, session })),
          walletEvents: fromCallback(() => {
            walletSubscribed()
          }),
        },
      })
      const actor = createActor(machine)

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
          init,
          restore: fromPromise<WalletStatusUpdate>(() =>
            Promise.resolve({ connection: unauthenticatedConnection, session }),
          ),
          walletEvents: fromCallback(({ sendBack }) => {
            sendBack({ type: 'wallet.statusChanged', status: { connection, session } })
          }),
        },
      })
      const actor = createActor(machine)

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)

      expect(actor.getSnapshot().matches({ session: 'authenticated' })).toBe(true)
      expect(actor.getSnapshot().context.connection).toBe(connection)

      actor.stop()
    })

    it('stops listening when session ends', async () => {
      const walletUnsubscribed = vi.fn()
      const machine = connectionMachine.provide({
        actors: {
          init,
          restore: fromPromise<WalletStatusUpdate>(() => Promise.resolve({ connection, session })),
          walletEvents: fromCallback(() => walletUnsubscribed),
        },
      })
      const actor = createActor(machine)

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
      const machine = connectionMachine.provide({
        actors: {
          init,
          restore: fromPromise<WalletStatusUpdate>(() => Promise.resolve({ connection, session })),
          walletEvents: fromCallback(() => {
            walletSubscribed()
          }),
        },
      })
      const actor = createActor(machine)

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)

      expect(walletSubscribed).toHaveBeenCalledOnce()

      actor.send({
        type: 'wallet.statusChanged',
        status: { connection: unauthenticatedConnection, session },
      })

      expect(actor.getSnapshot().matches({ session: 'unauthenticated' })).toBe(true)
      expect(walletSubscribed).toHaveBeenCalledOnce()

      actor.stop()
    })
  })

  describe('public status', () => {
    it('reports disconnected before anything happens', () => {
      const actor = createActor(connectionMachine)

      actor.start()

      expect(toConnectionStatus(actor.getSnapshot())).toBe('disconnected')

      actor.stop()
    })

    it('reports idle while initializing', () => {
      const machine = connectionMachine.provide({ actors: { init } })
      const actor = createActor(machine)

      actor.start()
      actor.send({ type: 'restore' })

      expect(toConnectionStatus(actor.getSnapshot())).toBe('idle')

      actor.stop()
    })

    it('reports connecting while the wallet decides', () => {
      const actor = createActor(connectionMachine)

      actor.start()
      actor.send({ type: 'connect' })

      expect(toConnectionStatus(actor.getSnapshot())).toBe('connecting')

      actor.stop()
    })

    it('reports connected for a live session', async () => {
      const machine = connectionMachine.provide({
        actors: {
          connect: fromPromise<WalletStatusUpdate>(() => Promise.resolve({ connection, session })),
        },
      })
      const actor = createActor(machine)

      actor.start()
      actor.send({ type: 'connect' })
      await pause(0)

      expect(toConnectionStatus(actor.getSnapshot())).toBe('connected')

      actor.stop()
    })

    it('reports connected for an unauthenticated session', async () => {
      const machine = connectionMachine.provide({
        actors: {
          init: fromPromise(() => Promise.resolve()),
          restore: fromPromise<WalletStatusUpdate>(() =>
            Promise.resolve({ connection: unauthenticatedConnection, session }),
          ),
        },
      })
      const actor = createActor(machine)

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)

      expect(toConnectionStatus(actor.getSnapshot())).toBe('connected')

      actor.stop()
    })

    it('reports idle while restoring', async () => {
      const machine = connectionMachine.provide({
        actors: {
          init: fromPromise(() => Promise.resolve()),
          restore: fromPromise<WalletStatusUpdate>(() => new Promise(() => {})),
        },
      })
      const actor = createActor(machine)

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)

      expect(toConnectionStatus(actor.getSnapshot())).toBe('idle')

      actor.stop()
    })

    it('reports disconnected after a failure', async () => {
      const machine = connectionMachine.provide({
        actors: {
          connect: fromPromise<WalletStatusUpdate>(() =>
            Promise.reject(new Error('picker exploded')),
          ),
        },
      })
      const actor = createActor(machine)

      actor.start()
      actor.send({ type: 'connect' })
      await pause(0)

      expect(toConnectionStatus(actor.getSnapshot())).toBe('disconnected')

      actor.stop()
    })
  })
})
