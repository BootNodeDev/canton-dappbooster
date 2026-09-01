import { useCallback } from 'react'
import { waitFor } from 'xstate'
import type { ConnectionActorRef } from '#src/machine/connectionMachine'

/** Resolves once the wallet has been asked, whichever state the machine started from. */
export const useDisconnectBridge = (actorRef: ConnectionActorRef): (() => Promise<void>) =>
  useCallback(async (): Promise<void> => {
    actorRef.send({ type: 'disconnect' })

    // A disconnect now always lands in `disconnected`; a connect asked for mid-disconnect is
    // ignored, not queued, so there is no `superseded` exit to wait on.
    await waitFor(actorRef, (snapshot) => snapshot.hasTag('disconnect.settled'))
  }, [actorRef])
