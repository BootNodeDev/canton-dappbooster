import { describe, expect, it } from 'vitest'
import { createActor } from 'xstate'
import { connectionMachine } from './connectionMachine'

describe('connectionMachine', () => {
  it('starts disconnected', () => {
    const actor = createActor(connectionMachine)

    actor.start()

    expect(actor.getSnapshot().matches('disconnected')).toBe(true)
  })
})
