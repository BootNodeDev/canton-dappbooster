// @vitest-environment node

import type { ConnectResult, StatusEvent } from '@canton-network/dapp-sdk'
import { describe, expect, it } from 'vitest'
import { createActor } from 'xstate'
import { createConnectionActors } from './connectionActors'
import { pause } from './testing'

const pickerExploded = new Error('picker exploded')

const connection: ConnectResult = { isConnected: true, isNetworkConnected: true }
const noSession: ConnectResult = { isConnected: false, isNetworkConnected: false }
const declined = { ...noSession, reason: 'user rejected' }

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

  it('surfaces the original error when no session is live', async () => {
    const sdk = {
      connect: () => Promise.reject(pickerExploded),
      status: () => Promise.resolve({ ...liveStatus, connection: noSession }),
    }
    const actor = createActor(createConnectionActors(sdk).connect)

    // making errors _observed_ avoiding global rethrows
    actor.subscribe({ error: () => {} })

    actor.start()
    await pause(0)

    expect(actor.getSnapshot().status).toBe('error')
    expect(actor.getSnapshot().error).toBe(pickerExploded)

    actor.stop()
  })

  it('surfaces the original error even when the probe itself fails', async () => {
    const sdk = {
      connect: () => Promise.reject(pickerExploded),
      status: () => Promise.reject(new Error('wallet unreachable')),
    }
    const actor = createActor(createConnectionActors(sdk).connect)

    actor.subscribe({ error: () => {} })

    actor.start()
    await pause(0)

    expect(actor.getSnapshot().status).toBe('error')
    expect(actor.getSnapshot().error).toBe(pickerExploded)

    actor.stop()
  })
})
