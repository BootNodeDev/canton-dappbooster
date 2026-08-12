// @vitest-environment node
import type { ConnectResult } from '@canton-network/dapp-sdk'
import { describe, expect, it, vi } from 'vitest'
import { createActor, fromPromise, type StateValueFrom } from 'xstate'
import { connectionMachine } from './connectionMachine'

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const recordStates = (actor: ReturnType<typeof createActor<typeof connectionMachine>>) => {
  const states: StateValueFrom<typeof connectionMachine>[] = []

  actor.subscribe(({ value }) => states.push(value))

  return states
}

const connection: ConnectResult = { isConnected: true, isNetworkConnected: true }

describe('connectionMachine', () => {
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
          connect: fromPromise(() => Promise.resolve(connection)),
        },
      })
      const actor = createActor(machine)

      actor.start()
      actor.send({ type: 'connect' })
      await pause(0)

      expect(actor.getSnapshot().matches('connected')).toBe(true)
      expect(actor.getSnapshot().context.connection).toBe(connection)

      actor.stop()
    })
  })

  describe('cancel', () => {
    it('aborts the in-flight connect attempt', () => {
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
            return Promise.resolve(connection)
          }),
        },
      })
      const actor = createActor(machine)

      actor.start()
      actor.send({ type: 'connect' })
      await pause(0)
      actor.send({ type: 'cancel' })

      expect(actor.getSnapshot().matches('connected')).toBe(true)
      expect(onAbort).not.toHaveBeenCalled()

      actor.stop()
    })
  })

  describe('failure', () => {
    it('lands in failure with the reason', async () => {
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
  })

  describe('disconnect', () => {
    it('returns to disconnected', async () => {
      const machine = connectionMachine.provide({
        actors: {
          connect: fromPromise(() => Promise.resolve(connection)),
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
        'connected',
        'disconnected',
      ])

      actor.stop()
    })

    it('drops the connection information', async () => {
      const machine = connectionMachine.provide({
        actors: {
          connect: fromPromise(() => Promise.resolve(connection)),
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
  })

  describe('session restore', () => {
    it('moves to restoring on restore', () => {
      const actor = createActor(connectionMachine)

      actor.start()
      actor.send({ type: 'restore' })

      expect(actor.getSnapshot().matches('restoring')).toBe(true)

      actor.stop()
    })

    it('restores an existing session to connected', async () => {
      const machine = connectionMachine.provide({
        actors: {
          restore: fromPromise(() => Promise.resolve(connection)),
        },
      })
      const actor = createActor(machine)

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)

      expect(actor.getSnapshot().matches('connected')).toBe(true)
      expect(actor.getSnapshot().context.connection).toBe(connection)

      actor.stop()
    })

    it('returns to disconnected when there is no session to restore', async () => {
      const machine = connectionMachine.provide({
        actors: {
          restore: fromPromise<ConnectResult>(() =>
            Promise.resolve({ isConnected: false, isNetworkConnected: false }),
          ),
        },
      })
      const actor = createActor(machine)
      const states = recordStates(actor)

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)

      expect(states).toEqual<typeof states>(['disconnected', 'restoring', 'disconnected'])
      expect(actor.getSnapshot().context.connection).toBeUndefined()
      expect(actor.getSnapshot().context.error).toBeUndefined()

      actor.stop()
    })

    it('returns to disconnected quietly when restore fails', async () => {
      const machine = connectionMachine.provide({
        actors: {
          restore: fromPromise(() => Promise.reject('failed to restore session')),
        },
      })
      const actor = createActor(machine)
      const states = recordStates(actor)

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)

      expect(states).toEqual<typeof states>(['disconnected', 'restoring', 'disconnected'])
      expect(actor.getSnapshot().context.connection).toBeUndefined()
      expect(actor.getSnapshot().context.error).toBeUndefined()

      actor.stop()
    })

    it('aborts the in-flight restore', () => {
      const onAbort = vi.fn()
      const machine = connectionMachine.provide({
        actors: {
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
      actor.send({ type: 'cancel' })

      expect(states).toEqual<typeof states>(['disconnected', 'restoring', 'disconnected'])
      expect(onAbort).toHaveBeenCalledOnce()

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
})
