import { type AnyActorLogic, createActor } from 'xstate'
import type { ConnectionActorRef } from '#src/machine/connectionMachine'
import { connectionInput } from '#src/testing/connectionInput'

/** Boots a `connectionMachine` variant on the fake-input actor input, already started. */
export const startConnection = (machine: AnyActorLogic): ConnectionActorRef => {
  const actor = createActor(machine, { input: connectionInput() }) as unknown as ConnectionActorRef
  actor.start()
  return actor
}
