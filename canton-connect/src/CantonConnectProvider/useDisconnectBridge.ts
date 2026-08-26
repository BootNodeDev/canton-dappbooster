import { useCallback } from 'react'
import { waitFor } from 'xstate'
import type { ConnectionActorRef } from '#src/machine/connectionMachine'

/** Resolves once the wallet has been asked, whichever state the machine started from. */
export const useDisconnectBridge = (actorRef: ConnectionActorRef): (() => Promise<void>) =>
  useCallback(async (): Promise<void> => {
    actorRef.send({ type: 'disconnect' })

    // `superseded` is a connect having taken over: the machine will never reach `disconnected`.
    await waitFor(
      actorRef,
      (snapshot) =>
        snapshot.hasTag('disconnect.settled') || snapshot.hasTag('disconnect.superseded'),
    )
  }, [actorRef])
