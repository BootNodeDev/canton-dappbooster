// @vitest-environment node

import type { ConnectResult, StatusEvent } from '@canton-network/dapp-sdk'
import { describe, expect, it } from 'vitest'
import { createActor } from 'xstate'
import { createConnectionActors } from './connectionActors'
import { pause } from './testing'

const connection: ConnectResult = { isConnected: true, isNetworkConnected: true }
const declined: ConnectResult = {
  isNetworkConnected: false,
  isConnected: false,
  reason: 'user rejected',
}

const liveStatus: StatusEvent = { connection, provider: { id: 'test-wallet' } }

describe('connect actor', () => {
  it('passes the wallet decline through untouched', async () => {
    const sdk = {
      connect: () => Promise.resolve(declined),
      status: () => {
        throw new Error('probe must not run on a resolved connect')
      },
    }
    const actor = createActor(createConnectionActors(sdk).connect)

    actor.start()
    await pause(0)

    expect(actor.getSnapshot().status).toBe('done')
    expect(actor.getSnapshot().output).toEqual(declined)

    actor.stop()
  })

  it('live session is not lost upon connect rejection', async () => {
    const sdk = {
      connect: () => Promise.reject(new Error('picker exploded')),
      status: () => Promise.resolve(liveStatus),
    }
    const actor = createActor(createConnectionActors(sdk).connect)

    actor.start()
    await pause(0)

    expect(actor.getSnapshot().status).toBe('done')
    expect(actor.getSnapshot().output).toEqual(liveStatus.connection)

    actor.stop()
  })
})
