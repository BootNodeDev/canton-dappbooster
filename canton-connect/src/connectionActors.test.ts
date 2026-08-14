// @vitest-environment node

import type { ConnectResult, StatusEvent } from '@canton-network/dapp-sdk'
import { describe, expect, it, vi } from 'vitest'
import { createActor } from 'xstate'
import { createConnectionActors } from './connectionActors'
import type { WalletStatus } from './connectionMachine'
import { createMockAdapter } from './mock/mockAdapter'
import { pause } from './testing'

const pickerExploded = new Error('picker exploded')

const connection: ConnectResult = { isConnected: true, isNetworkConnected: true }
const noSession: ConnectResult = { isConnected: false, isNetworkConnected: false }
const declined = { ...noSession, reason: 'user rejected' }

const liveStatus: StatusEvent = { connection, provider: { id: 'test-wallet' } }

const session: WalletStatus['session'] = { accessToken: 'token', userId: 'user' }

describe('connectionActors', () => {
  describe('connect actor', () => {
    const init = () => {
      throw new Error('init must not run during connect')
    }

    it('passes the wallet decline through untouched', async () => {
      const sdk = {
        connect: () => Promise.resolve(declined),
        init,
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
        init,
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
        init,
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
        init,
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

  describe('restore actor', () => {
    const connect = () => {
      throw new Error('connect must not run during restore')
    }

    it('restores the wallet connection and session from status', async () => {
      const restorable: StatusEvent = { ...liveStatus, session }
      const sdk = {
        connect,
        init: () => Promise.resolve(),
        status: () => Promise.resolve(restorable),
      }
      const actor = createActor(createConnectionActors(sdk).restore)

      actor.start()
      await pause(0)

      expect(actor.getSnapshot().status).toBe('done')
      expect(actor.getSnapshot().output).toEqual({
        connection: restorable.connection,
        session: restorable.session,
      })

      actor.stop()
    })

    it('keeps the SDK default gateways out unless opted in', async () => {
      const init = vi.fn(() => Promise.resolve())
      const sdk = {
        connect,
        init,
        status: () => Promise.resolve({ ...liveStatus, session }),
      }
      const actor = createActor(createConnectionActors(sdk).restore)

      actor.start()
      await pause(0)

      expect(actor.getSnapshot().status).toBe('done')
      expect(init).toHaveBeenCalledWith({ defaultAdapters: [] })

      actor.stop()
    })

    it('forwards the caller init options to the SDK', async () => {
      const init = vi.fn(() => Promise.resolve())
      const sdk = {
        connect,
        init,
        status: () => Promise.resolve({ ...liveStatus, session }),
      }
      const mockAdapter = createMockAdapter()
      const actor = createActor(
        createConnectionActors(sdk, { additionalAdapters: [], defaultAdapters: [mockAdapter] })
          .restore,
      )

      actor.start()
      await pause(0)

      expect(actor.getSnapshot().status).toBe('done')
      expect(init).toHaveBeenCalledWith({ additionalAdapters: [], defaultAdapters: [mockAdapter] })

      actor.stop()
    })

    it('surfaces the restore failure untouched', async () => {
      const failedToRecoverStatus = new Error('failed to recover status')
      const sdk = {
        connect,
        init: () => Promise.resolve(),
        status: () => Promise.reject(failedToRecoverStatus),
      }
      const actor = createActor(createConnectionActors(sdk).restore)

      actor.subscribe({ error: () => {} })

      actor.start()
      await pause(0)

      expect(actor.getSnapshot().status).toBe('error')
      expect(actor.getSnapshot().error).toBe(failedToRecoverStatus)

      actor.stop()
    })
  })
})
