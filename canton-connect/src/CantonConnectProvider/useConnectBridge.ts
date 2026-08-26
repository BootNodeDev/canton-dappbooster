import { useCallback } from 'react'
import { waitFor } from 'xstate'
import { ConnectCancelledError, toConnectError } from '#src/connectError'
import type { ConnectionActorRef } from '#src/machine/connectionMachine'

/**
 * Turns the machine's `connect` event into a promise. The machine's own tags say when an attempt
 * has been answered, and its context carries what to raise.
 */
export const useConnectBridge = (actorRef: ConnectionActorRef): (() => Promise<void>) => {
  const connect = useCallback(async (): Promise<void> => {
    // Send first: the transition is synchronous, so the machine is already mid-attempt when
    // `waitFor` reads it, and an answer left over from the last attempt cannot settle this one.
    actorRef.send({ type: 'connect' })

    // Rejects if the actor is stopped without answering, which is a provider unmounting
    // mid-attempt.
    const settled = await waitFor(
      actorRef,
      (snapshot) =>
        snapshot.hasTag('connect.settled') ||
        snapshot.hasTag('connect.failed') ||
        snapshot.hasTag('connect.cancelled'),
    )

    if (settled.hasTag('connect.settled')) {
      return
    }

    if (settled.hasTag('connect.cancelled')) {
      throw new ConnectCancelledError()
    }

    throw toConnectError(settled.context.lastConnectError)
  }, [actorRef])

  return connect
}
