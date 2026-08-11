import type { ConnectResult } from '@canton-network/dapp-sdk'
import { describe, expect, it, vi } from 'vitest'
import { createActor, fromPromise, type StateValueFrom } from 'xstate'
import { connectionMachine } from './connectionMachine'

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const connection: ConnectResult = { isConnected: true, isNetworkConnected: true }

describe('connectionMachine', () => {
  it('starts disconnected', () => {
    const actor = createActor(connectionMachine)

    actor.start()

    expect(actor.getSnapshot().matches('disconnected')).toBe(true)
  })

  describe('connect attempt', () => {
    it('moves to connecting on connect', () => {
      const actor = createActor(connectionMachine)

      actor.start()
      actor.send({ type: 'connect' })

      expect(actor.getSnapshot().matches('connecting')).toBe(true)
    })

    it('reaches connected when the attempt resolves', async () => {
      const machine = connectionMachine.provide({
        actors: {
          connect: fromPromise(() => Promise.resolve(connection)),
        },
      })
      const actor = createActor(machine)

      actor.start()
      actor.send({ type: 'connect' })
      await pause(0) // queue ordering

      expect(actor.getSnapshot().matches('connected')).toBe(true)
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
    })

    it('allows connecting again', async () => {
      const machine = connectionMachine.provide({
        actors: {
          connect: fromPromise(() => Promise.reject(new Error('wallet rejected'))),
        },
      })

      const actor = createActor(machine)
      const states: StateValueFrom<typeof machine>[] = []
      actor.subscribe(({ value }) => states.push(value))

      actor.start()
      actor.send({ type: 'connect' })
      await pause(0)
      actor.send({ type: 'connect' })

      expect(states).toEqual<typeof states>(['disconnected', 'connecting', 'failure', 'connecting'])
    })

    it('drops the previous error when retrying', async () => {
      const machine = connectionMachine.provide({
        actors: {
          connect: fromPromise(() => Promise.reject(new Error('wallet rejected'))),
        },
      })
      const actor = createActor(machine)
      const states: StateValueFrom<typeof machine>[] = []
      actor.subscribe(({ value }) => states.push(value))

      actor.start()
      actor.send({ type: 'connect' })
      await pause(0)
      actor.send({ type: 'connect' })

      expect(actor.getSnapshot().context.error).toBeUndefined()

      expect(states).toEqual<typeof states>(['disconnected', 'connecting', 'failure', 'connecting'])
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
      const states: StateValueFrom<typeof machine>[] = []
      actor.subscribe(({ value }) => states.push(value))

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
    })
  })

  describe('session restore', () => {
    it('moves to restoring on restore', () => {
      const actor = createActor(connectionMachine)

      actor.start()
      actor.send({ type: 'restore' })

      expect(actor.getSnapshot().matches('restoring')).toBe(true)
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
      const states: StateValueFrom<typeof machine>[] = []
      actor.subscribe(({ value }) => states.push(value))

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)

      expect(states).toEqual<typeof states>(['disconnected', 'restoring', 'disconnected'])
      expect(actor.getSnapshot().context.connection).toBeUndefined()
      expect(actor.getSnapshot().context.error).toBeUndefined()
    })

    it('returns to disconnected quietly when restore fails', async () => {
      const machine = connectionMachine.provide({
        actors: {
          restore: fromPromise(() => Promise.reject('failed to restore session')),
        },
      })
      const actor = createActor(machine)
      const states: StateValueFrom<typeof machine>[] = []
      actor.subscribe(({ value }) => states.push(value))

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)

      expect(states).toEqual<typeof states>(['disconnected', 'restoring', 'disconnected'])
      expect(actor.getSnapshot().context.connection).toBeUndefined()
      expect(actor.getSnapshot().context.error).toBeUndefined()
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
