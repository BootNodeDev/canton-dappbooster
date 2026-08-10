import type { ConnectResult } from '@canton-network/dapp-sdk'
import { describe, expect, it, vi } from 'vitest'
import { createActor, fromPromise } from 'xstate'
import { connectionMachine } from './connectionMachine'

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const connection: ConnectResult = { isConnected: true, isNetworkConnected: true }

describe('connectionMachine', () => {
  it('starts disconnected', () => {
    const actor = createActor(connectionMachine)

    actor.start()

    expect(actor.getSnapshot().matches('disconnected')).toBe(true)
  })

  it('moves to connecting on connect', () => {
    const actor = createActor(connectionMachine)

    actor.start()
    actor.send({ type: 'connect' })

    expect(actor.getSnapshot().matches('connecting')).toBe(true)
  })

  it('reaches connected when the connect attempt resolves', async () => {
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

  it('aborts the in-flight connect attempt on cancel', () => {
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

  it('lands in failure with the reason when the connect attempt rejects', async () => {
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

  it('allows connecting again after a failure', async () => {
    const machine = connectionMachine.provide({
      actors: {
        connect: fromPromise(() => Promise.reject(new Error('wallet rejected'))),
      },
    })

    const actor = createActor(machine)

    actor.start()
    actor.send({ type: 'connect' })
    await pause(0)
    actor.send({ type: 'connect' })

    expect(actor.getSnapshot().matches('connecting')).toBe(true)
  })

  it('drops the previous error when retrying', async () => {
    const machine = connectionMachine.provide({
      actors: {
        connect: fromPromise(() => Promise.reject(new Error('wallet rejected'))),
      },
    })

    const actor = createActor(machine)
    actor.start()
    actor.send({ type: 'connect' })
    await pause(0)
    actor.send({ type: 'connect' })

    expect(actor.getSnapshot().context.error).toBeUndefined()
  })

  it('allows to disconnect after connection is established', async () => {
    const machine = connectionMachine.provide({
      actors: {
        connect: fromPromise(() => Promise.resolve(connection)),
      },
    })
    const actor = createActor(machine)

    actor.start()
    actor.send({ type: 'connect' })
    await pause(0)

    actor.send({ type: 'disconnect' })

    expect(actor.getSnapshot().matches('disconnected')).toBe(true)
  })

  it('ignores a cancel request if connection is settled', async () => {
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

  it('stores the connect result in context when the attempt resolves', async () => {
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

  it('drops connection information on disconnect', async () => {
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
