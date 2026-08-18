// @vitest-environment node

import type { ConnectResult, StatusEvent } from '@canton-network/dapp-sdk'
import { describe, expect, it, vi } from 'vitest'
import { createActor } from 'xstate'
import { createConnectionActors } from './connectionActors'
import { connectionMachine, type WalletStatus } from './connectionMachine'
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
    const init = () => Promise.resolve()
    const onStatusChanged = () => {
      throw new Error('pushes must not be wired during connect')
    }
    const removeOnStatusChanged = () => {
      throw new Error('teardown must not run during connect')
    }
    const status = () => {
      throw new Error('probe must not run on a resolved connect')
    }

    it('initializes the SDK before connecting', async () => {
      const init = vi.fn(() => Promise.resolve())
      const sdk = {
        connect: () => Promise.resolve(connection),
        init,
        onStatusChanged,
        removeOnStatusChanged,
        status,
      }
      const mockAdapter = createMockAdapter()
      const actor = createActor(
        createConnectionActors(sdk, { additionalAdapters: [mockAdapter] }).connect,
      )

      actor.start()
      await pause(0)

      expect(actor.getSnapshot().status).toBe('done')
      expect(init).toHaveBeenCalledWith({ defaultAdapters: [], additionalAdapters: [mockAdapter] })

      actor.stop()
    })

    it('passes the wallet decline through untouched', async () => {
      const sdk = {
        connect: () => Promise.resolve(declined),
        init,
        onStatusChanged,
        removeOnStatusChanged,
        status,
      }
      const actor = createActor(createConnectionActors(sdk).connect)

      actor.start()
      await pause(0)

      expect(actor.getSnapshot().status).toBe('done')
      expect(actor.getSnapshot().output).toEqual({ connection: declined })

      actor.stop()
    })

    it('live session is not lost upon connect rejection', async () => {
      const sdk = {
        connect: () => Promise.reject(pickerExploded),
        init,
        onStatusChanged,
        removeOnStatusChanged,
        status: () => Promise.resolve(liveStatus),
      }
      const actor = createActor(createConnectionActors(sdk).connect)

      actor.start()
      await pause(0)

      expect(actor.getSnapshot().status).toBe('done')
      expect(actor.getSnapshot().output).toEqual({ connection: liveStatus.connection })

      actor.stop()
    })

    it('recovers the session alongside the connection', async () => {
      const recovered: StatusEvent = { ...liveStatus, session }
      const sdk = {
        connect: () => Promise.reject(pickerExploded),
        init,
        onStatusChanged,
        removeOnStatusChanged,
        status: () => Promise.resolve(recovered),
      }
      const actor = createActor(createConnectionActors(sdk).connect)

      actor.start()
      await pause(0)

      expect(actor.getSnapshot().status).toBe('done')
      expect(actor.getSnapshot().output).toEqual({
        connection: recovered.connection,
        session: recovered.session,
      })

      actor.stop()
    })

    it('surfaces the original error when no session is live', async () => {
      const sdk = {
        connect: () => Promise.reject(pickerExploded),
        init,
        onStatusChanged,
        removeOnStatusChanged,
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
        onStatusChanged,
        removeOnStatusChanged,
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
    const onStatusChanged = () => {
      throw new Error('pushes must not be wired during restore')
    }
    const removeOnStatusChanged = () => {
      throw new Error('teardown must not run during restore')
    }

    it('restores the wallet connection and session from status', async () => {
      const restorable: StatusEvent = { ...liveStatus, session }
      const sdk = {
        connect,
        init: () => Promise.resolve(),
        onStatusChanged,
        removeOnStatusChanged,
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
        onStatusChanged,
        removeOnStatusChanged,
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
        onStatusChanged,
        removeOnStatusChanged,
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
        onStatusChanged,
        removeOnStatusChanged,
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

  describe('walletEvents actor', () => {
    const connect = () => {
      throw new Error('connect must not run while listening for pushes')
    }

    it('delivers wallet status pushes while a session exists', async () => {
      let captured: ((event: StatusEvent) => void) | undefined

      const restorable: StatusEvent = { ...liveStatus, session }
      const sdk = {
        connect,
        init: () => Promise.resolve(),
        status: () => Promise.resolve(restorable),
        onStatusChanged: (listener: (event: StatusEvent) => void) => {
          captured = listener
          return Promise.resolve()
        },
        removeOnStatusChanged: () => Promise.resolve(),
      }
      const actor = createActor(connectionMachine.provide({ actors: createConnectionActors(sdk) }))

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)

      expect(actor.getSnapshot().value).toEqual({ session: 'authenticated' })
      expect(captured).toBeDefined()

      captured?.({ ...restorable, connection: noSession })

      expect(actor.getSnapshot().value).toEqual({ session: 'unauthenticated' })

      actor.stop()
    })

    it('stops listening when the session ends', async () => {
      let captured: ((event: StatusEvent) => void) | undefined

      const restorable: StatusEvent = { ...liveStatus, session }
      const removeOnStatusChanged = vi.fn(() => Promise.resolve())
      const sdk = {
        connect,
        init: () => Promise.resolve(),
        onStatusChanged: (listener: (event: StatusEvent) => void) => {
          captured = listener
          return Promise.resolve()
        },
        removeOnStatusChanged,
        status: () => Promise.resolve(restorable),
      }
      const actor = createActor(connectionMachine.provide({ actors: createConnectionActors(sdk) }))

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)

      expect(captured).toBeDefined()

      actor.send({ type: 'disconnect' })

      expect(removeOnStatusChanged).toHaveBeenCalledWith(captured)

      actor.stop()
    })
  })
})
