// @vitest-environment node

import type { ConnectResult, StatusEvent } from '@canton-network/dapp-sdk'
import { describe, expect, it, vi } from 'vitest'
import { createActor } from 'xstate'
import { createConnectionActors } from './connectionActors'
import { connectionMachine, type WalletStatusUpdate } from './connectionMachine'
import { createMockAdapter } from './mock/mockAdapter'
// Not the './testing' barrel: it re-exports fakeSession, whose Lit-backed SDK import needs a DOM.
import { pause } from './testing/pause'

const pickerExploded = new Error('picker exploded')

const connection: ConnectResult = { isConnected: true, isNetworkConnected: true }
const unauthenticatedConnection: ConnectResult = { ...connection, isConnected: false }
const declined = { ...unauthenticatedConnection, reason: 'user rejected' }

const liveStatus: StatusEvent = { connection, provider: { id: 'test-wallet' } }

const session: WalletStatusUpdate['session'] = { accessToken: 'token', userId: 'user' }

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
      throw new Error('status must not be read on a resolved connect')
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
        status: () => Promise.resolve({ ...liveStatus, connection: unauthenticatedConnection }),
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

    it('surfaces the original error even when the check itself fails', async () => {
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

  describe('init actor', () => {
    const connect = () => {
      throw new Error('connect must not run during init')
    }
    const onStatusChanged = () => {
      throw new Error('pushes must not be wired during init')
    }
    const removeOnStatusChanged = () => {
      throw new Error('teardown must not run during init')
    }
    const status = () => {
      throw new Error('status must not be read during init')
    }

    it('inits the SDK once per factory', async () => {
      const sdkInit = vi.fn(() => Promise.resolve())
      const sdk = {
        connect,
        init: sdkInit,
        onStatusChanged,
        removeOnStatusChanged,
        status,
      }
      const { init } = createConnectionActors(sdk)

      const firstActor = createActor(init)
      firstActor.start()
      await pause(0)

      expect(firstActor.getSnapshot().status).toBe('done')

      const secondActor = createActor(init)
      secondActor.start()
      await pause(0)

      expect(secondActor.getSnapshot().status).toBe('done')
      expect(sdkInit).toHaveBeenCalledOnce()

      firstActor.stop()
      secondActor.stop()
    })

    it('keeps the SDK default gateways out unless opted in', async () => {
      const sdkInit = vi.fn(() => Promise.resolve())
      const sdk = {
        connect,
        init: sdkInit,
        onStatusChanged,
        removeOnStatusChanged,
        status,
      }
      const actor = createActor(createConnectionActors(sdk).init)

      actor.start()
      await pause(0)

      expect(actor.getSnapshot().status).toBe('done')
      expect(sdkInit).toHaveBeenCalledWith({ defaultAdapters: [] })

      actor.stop()
    })

    it('forwards the caller init options to the SDK', async () => {
      const sdkInit = vi.fn(() => Promise.resolve())
      const sdk = {
        connect,
        init: sdkInit,
        onStatusChanged,
        removeOnStatusChanged,
        status,
      }
      const mockAdapter = createMockAdapter()
      const actor = createActor(
        createConnectionActors(sdk, { additionalAdapters: [], defaultAdapters: [mockAdapter] })
          .init,
      )

      actor.start()
      await pause(0)

      expect(actor.getSnapshot().status).toBe('done')
      expect(sdkInit).toHaveBeenCalledWith({
        additionalAdapters: [],
        defaultAdapters: [mockAdapter],
      })

      actor.stop()
    })

    it('retries init after a failure', async () => {
      const initError = new Error('init failed')
      const sdkInit = vi.fn(() => Promise.resolve()).mockRejectedValueOnce(initError)
      const sdk = {
        connect,
        init: sdkInit,
        onStatusChanged,
        removeOnStatusChanged,
        status,
      }
      const { init } = createConnectionActors(sdk)

      const firstActor = createActor(init)
      firstActor.subscribe({ error: () => {} })
      firstActor.start()
      await pause(0)

      expect(firstActor.getSnapshot().status).toBe('error')
      expect(firstActor.getSnapshot().error).toBe(initError)

      const secondActor = createActor(init)
      secondActor.start()
      await pause(0)

      expect(secondActor.getSnapshot().status).toBe('done')
      expect(sdkInit).toHaveBeenCalledTimes(2)

      firstActor.stop()
      secondActor.stop()
    })
  })

  describe('restore actor', () => {
    const connect = () => {
      throw new Error('connect must not run during restore')
    }
    const init = () => {
      throw new Error('init must not run during restore')
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
        init,
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

    it('surfaces the restore failure untouched', async () => {
      const failedToRecoverStatus = new Error('failed to recover status')
      const sdk = {
        connect,
        init,
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

      captured?.({ ...restorable, connection: unauthenticatedConnection })

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
