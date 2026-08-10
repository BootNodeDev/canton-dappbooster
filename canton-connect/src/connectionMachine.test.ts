import { describe, expect, it } from 'vitest'
import { createActor } from 'xstate'
import { connectionMachine } from './connectionMachine'

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

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
    const actor = createActor(connectionMachine)

    actor.start()
    actor.send({ type: 'connect' })
    await pause(0) // queue ordering

    expect(actor.getSnapshot().matches('connected')).toBe(true)
  })
})
