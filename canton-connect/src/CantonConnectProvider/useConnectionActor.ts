import { useActorRef } from '@xstate/react'
import { useEffect } from 'react'
import {
  type ConnectionActorRef,
  type ConnectionInput,
  connectionMachine,
} from '#src/machine/connectionMachine'

/** Creates the connection actor and sends `restore` once it starts, so a prior session resumes. */
export const useConnectionActor = (input: ConnectionInput): ConnectionActorRef => {
  const actorRef = useActorRef(connectionMachine, { input })

  // Sent from an effect, not at creation: useActorRef starts the actor in one of its own.
  useEffect(() => {
    actorRef.send({ type: 'restore' })
  }, [actorRef])

  return actorRef
}
