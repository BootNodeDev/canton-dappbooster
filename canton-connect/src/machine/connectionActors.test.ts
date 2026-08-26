// @vitest-environment node

import type { ConnectResult, StatusEvent } from '@canton-network/dapp-sdk'
import { describe, expect, it, vi } from 'vitest'
import { createActor } from 'xstate'
import { PickerClosedError } from '#src/connectError'
import {
  connect as connectActor,
  disconnect as disconnectActor,
  init as initActor,
  restore as restoreActor,
} from '#src/machine/connectionActors'
import { connectionMachine } from '#src/machine/connectionMachine'
import { createMockAdapter } from '#src/mock/mockAdapter'
// Not the './testing' barrel: it re-exports fakeSession, whose Lit-backed SDK import needs a DOM.
import { connectionInput } from '#src/testing/connectionInput'
import { pause } from '#src/testing/pause'
import type { WalletSdk } from '#src/types'

const pickerExploded = new Error('picker exploded')

const connection: ConnectResult = { isConnected: true, isNetworkConnected: true }
const unauthenticatedConnection: ConnectResult = { ...connection, isConnected: false }
const declined = { ...unauthenticatedConnection, reason: 'user rejected' }

const liveStatus: StatusEvent = { connection, provider: { id: 'test-wallet' } }

const notAllowed = (method: string) => () => {
  throw new Error(`sdk.${method} must not be called in this test`)
}

type TestSdk = Pick<
  WalletSdk,
  'connect' | 'disconnect' | 'init' | 'onStatusChanged' | 'removeOnStatusChanged' | 'status'
>

// States the methods a test's actor may touch; every other one throws naming itself, so a
// wrongly wired call fails loudly instead of silently reading past what the test set up.
const sdkAllowing = (overrides: Partial<TestSdk>): TestSdk => ({
  connect: overrides.connect ?? notAllowed('connect'),
  disconnect: overrides.disconnect ?? notAllowed('disconnect'),
  init: overrides.init ?? notAllowed('init'),
  onStatusChanged: overrides.onStatusChanged ?? notAllowed('onStatusChanged'),
  removeOnStatusChanged: overrides.removeOnStatusChanged ?? notAllowed('removeOnStatusChanged'),
  status: overrides.status ?? notAllowed('status'),
})

describe('connectionActors', () => {
  describe('connect actor', () => {
    // No window in this file, so guardedConnect passes straight through to sdk.connect()
    const guardPicker = true
    const init = () => Promise.resolve()

    it('initializes the SDK before connecting', async () => {
      const init = vi.fn(() => Promise.resolve())
      const connect = vi.fn(() => Promise.resolve(connection))
      const sdk = sdkAllowing({ connect, init })
      const mockAdapter = createMockAdapter()
      const actor = createActor(connectActor, {
        input: { sdk, initOptions: { additionalAdapters: [mockAdapter] }, guardPicker },
      })

      actor.start()
      await pause(0)

      expect(actor.getSnapshot().status).toBe('done')
      expect(init).toHaveBeenCalledWith({ defaultAdapters: [], additionalAdapters: [mockAdapter] })
      // the order is the point: connect() inits with no options of its own, so a later init loses
      // the caller's adapters
      expect(init.mock.invocationCallOrder[0]).toBeLessThan(connect.mock.invocationCallOrder[0])

      actor.stop()
    })

    it('live session is not lost upon connect rejection', async () => {
      const sdk = sdkAllowing({
        connect: () => Promise.reject(pickerExploded),
        init,
        status: () => Promise.resolve(liveStatus),
      })
      const actor = createActor(connectActor, { input: { sdk, initOptions: {}, guardPicker } })

      actor.start()
      await pause(0)

      expect(actor.getSnapshot().status).toBe('done')
      expect(actor.getSnapshot().output).toEqual({ connection: liveStatus.connection })

      actor.stop()
    })

    it('surfaces the original error when no session is live', async () => {
      const sdk = sdkAllowing({
        connect: () => Promise.reject(pickerExploded),
        init,
        status: () => Promise.resolve({ ...liveStatus, connection: unauthenticatedConnection }),
      })
      const actor = createActor(connectActor, { input: { sdk, initOptions: {}, guardPicker } })

      // making errors _observed_ avoiding global rethrows
      actor.subscribe({ error: () => {} })

      actor.start()
      await pause(0)

      expect(actor.getSnapshot().status).toBe('error')
      expect(actor.getSnapshot().error).toBe(pickerExploded)

      actor.stop()
    })

    it('surfaces the original error even when the check itself fails', async () => {
      const sdk = sdkAllowing({
        connect: () => Promise.reject(pickerExploded),
        init,
        status: () => Promise.reject(new Error('wallet unreachable')),
      })
      const actor = createActor(connectActor, { input: { sdk, initOptions: {}, guardPicker } })

      actor.subscribe({ error: () => {} })

      actor.start()
      await pause(0)

      expect(actor.getSnapshot().status).toBe('error')
      expect(actor.getSnapshot().error).toBe(pickerExploded)

      actor.stop()
    })

    // The one rejection that must not be recovered from: sdk.connect() is still running inside
    // this instance, so the machine has to retire it rather than keep it over a live session.
    it('rethrows a closed picker without asking for a live session', async () => {
      const closed = new PickerClosedError()
      const statusRead = vi.fn(() => Promise.resolve(liveStatus))
      const sdk = sdkAllowing({
        connect: () => Promise.reject(closed),
        init,
        status: statusRead,
      })
      const actor = createActor(connectActor, { input: { sdk, initOptions: {}, guardPicker } })

      actor.subscribe({ error: () => {} })

      actor.start()
      await pause(0)

      expect(actor.getSnapshot().status).toBe('error')
      expect(actor.getSnapshot().error).toBe(closed)
      expect(statusRead).not.toHaveBeenCalled()

      actor.stop()
    })

    it('recovers the live session when the wallet declines the connection', async () => {
      const sdk = sdkAllowing({
        connect: () => Promise.resolve(declined),
        init,
        status: () => Promise.resolve(liveStatus),
      })
      const actor = createActor(connectActor, { input: { sdk, initOptions: {}, guardPicker } })

      actor.start()
      await pause(0)

      expect(actor.getSnapshot().status).toBe('done')
      expect(actor.getSnapshot().output).toEqual({ connection: liveStatus.connection })

      actor.stop()
    })

    it('keeps the decline when the status read reports nothing live', async () => {
      const sdk = sdkAllowing({
        connect: () => Promise.resolve(declined),
        init,
        status: () => Promise.resolve({ ...liveStatus, connection: unauthenticatedConnection }),
      })
      const actor = createActor(connectActor, { input: { sdk, initOptions: {}, guardPicker } })

      actor.start()
      await pause(0)

      expect(actor.getSnapshot().status).toBe('done')
      expect(actor.getSnapshot().output).toEqual({ connection: declined })

      actor.stop()
    })
  })

  describe('init actor', () => {
    it('inits the SDK once per instance', async () => {
      const sdkInit = vi.fn(() => Promise.resolve())
      const sdk = sdkAllowing({ init: sdkInit })
      const input = { sdk, initOptions: {} }

      const firstActor = createActor(initActor, { input })
      firstActor.start()
      await pause(0)

      expect(firstActor.getSnapshot().status).toBe('done')

      const secondActor = createActor(initActor, { input })
      secondActor.start()
      await pause(0)

      expect(secondActor.getSnapshot().status).toBe('done')
      expect(sdkInit).toHaveBeenCalledOnce()

      firstActor.stop()
      secondActor.stop()
    })

    it('keeps the SDK default gateways out unless opted in', async () => {
      const sdkInit = vi.fn(() => Promise.resolve())
      const sdk = sdkAllowing({ init: sdkInit })
      const actor = createActor(initActor, { input: { sdk, initOptions: {} } })

      actor.start()
      await pause(0)

      expect(actor.getSnapshot().status).toBe('done')
      expect(sdkInit).toHaveBeenCalledWith({ defaultAdapters: [] })

      actor.stop()
    })

    it('forwards the caller init options to the SDK', async () => {
      const sdkInit = vi.fn(() => Promise.resolve())
      const sdk = sdkAllowing({ init: sdkInit })
      const mockAdapter = createMockAdapter()
      const actor = createActor(initActor, {
        input: { sdk, initOptions: { additionalAdapters: [], defaultAdapters: [mockAdapter] } },
      })

      actor.start()
      await pause(0)

      expect(actor.getSnapshot().status).toBe('done')
      expect(sdkInit).toHaveBeenCalledWith({
        additionalAdapters: [],
        defaultAdapters: [mockAdapter],
      })

      actor.stop()
    })

    // The SDK chains onto its own rejected init promise and never clears it, so a second init
    // rejects with the first error. Asking again would burn a round trip to learn nothing.
    it('logs a failed init once, not once per attempt', async () => {
      const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
      const initError = new Error('bad adapter config')
      const sdk = sdkAllowing({ init: () => Promise.reject(initError) })
      const input = { sdk, initOptions: {} }

      // three awaits of the one cached rejection
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const actor = createActor(initActor, { input })
        actor.subscribe({ error: () => {} })
        actor.start()
        await pause(0)

        expect(actor.getSnapshot().error).toBe(initError)
        actor.stop()
      }

      expect(logged).toHaveBeenCalledOnce()
      expect(logged.mock.calls[0]?.[1]).toBe(initError)

      logged.mockRestore()
    })

    it('keeps reporting the first failure without asking the SDK again', async () => {
      const initError = new Error('init failed')
      const sdkInit = vi.fn(() => Promise.reject(initError))
      const sdk = sdkAllowing({ init: sdkInit })
      const input = { sdk, initOptions: {} }

      const firstActor = createActor(initActor, { input })
      firstActor.subscribe({ error: () => {} })
      firstActor.start()
      await pause(0)

      expect(firstActor.getSnapshot().status).toBe('error')
      expect(firstActor.getSnapshot().error).toBe(initError)

      const secondActor = createActor(initActor, { input })
      secondActor.subscribe({ error: () => {} })
      secondActor.start()
      await pause(0)

      expect(secondActor.getSnapshot().status).toBe('error')
      expect(secondActor.getSnapshot().error).toBe(initError)
      expect(sdkInit).toHaveBeenCalledTimes(1)

      firstActor.stop()
      secondActor.stop()
    })
  })

  describe('restore actor', () => {
    it('restores the wallet connection from status', async () => {
      const restorable: StatusEvent = liveStatus
      const sdk = sdkAllowing({ status: () => Promise.resolve(restorable) })
      const actor = createActor(restoreActor, { input: { sdk } })

      actor.start()
      await pause(0)

      expect(actor.getSnapshot().status).toBe('done')
      expect(actor.getSnapshot().output).toEqual({ connection: restorable.connection })

      actor.stop()
    })

    it('surfaces the restore failure untouched', async () => {
      const failedToRecoverStatus = new Error('failed to recover status')
      const sdk = sdkAllowing({ status: () => Promise.reject(failedToRecoverStatus) })
      const actor = createActor(restoreActor, { input: { sdk } })

      actor.subscribe({ error: () => {} })

      actor.start()
      await pause(0)

      expect(actor.getSnapshot().status).toBe('error')
      expect(actor.getSnapshot().error).toBe(failedToRecoverStatus)

      actor.stop()
    })

    // A cold visitor's status() rejects too, so this is the ordinary path, not an alarm.
    it('notes an unrestored session at debug and still rejects', async () => {
      const noted = vi.spyOn(console, 'debug').mockImplementation(() => {})
      const notConnected = new Error('Not connected — call connect() first')
      const sdk = sdkAllowing({ status: () => Promise.reject(notConnected) })
      const actor = createActor(restoreActor, { input: { sdk } })

      actor.subscribe({ error: () => {} })

      actor.start()
      await pause(0)

      expect(noted).toHaveBeenCalledOnce()
      expect(noted.mock.calls[0]?.[1]).toBe(notConnected)
      expect(actor.getSnapshot().error).toBe(notConnected)

      noted.mockRestore()
      actor.stop()
    })
  })

  describe('walletEvents actor, through the machine', () => {
    const disconnect = () => Promise.resolve(null)

    it('delivers wallet status pushes while a session exists', async () => {
      let captured: ((event: StatusEvent) => void) | undefined

      const restorable: StatusEvent = liveStatus
      const sdk = sdkAllowing({
        disconnect,
        init: () => Promise.resolve(),
        status: () => Promise.resolve(restorable),
        onStatusChanged: (listener) => {
          captured = listener
          return Promise.resolve()
        },
        removeOnStatusChanged: () => Promise.resolve(),
      })
      const actor = createActor(connectionMachine, { input: connectionInput(sdk) })

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)

      expect(actor.getSnapshot().matches({ session: 'authenticated' })).toBe(true)
      expect(captured).toBeDefined()

      captured?.({ ...restorable, connection: unauthenticatedConnection })

      expect(actor.getSnapshot().value).toEqual({ session: 'unauthenticated' })

      actor.stop()
    })

    it('stops listening when the session ends', async () => {
      let captured: ((event: StatusEvent) => void) | undefined

      const restorable: StatusEvent = liveStatus
      const removeOnStatusChanged = vi.fn(() => Promise.resolve())
      const sdk = sdkAllowing({
        disconnect,
        init: () => Promise.resolve(),
        onStatusChanged: (listener) => {
          captured = listener
          return Promise.resolve()
        },
        removeOnStatusChanged,
        status: () => Promise.resolve(restorable),
      })
      const actor = createActor(connectionMachine, { input: connectionInput(sdk) })

      actor.start()
      actor.send({ type: 'restore' })
      await pause(0)

      expect(captured).toBeDefined()

      actor.send({ type: 'disconnect' })

      expect(removeOnStatusChanged).toHaveBeenCalledWith(captured)

      actor.stop()
    })
  })

  describe('disconnect actor', () => {
    it('ends the wallet session at the SDK', async () => {
      const sdkDisconnect = vi.fn(() => Promise.resolve(null))
      const sdk = sdkAllowing({ disconnect: sdkDisconnect })
      const actor = createActor(disconnectActor, { input: { sdk } })

      actor.start()
      await pause(0)

      expect(actor.getSnapshot().status).toBe('done')
      expect(sdkDisconnect).toHaveBeenCalledOnce()

      actor.stop()
    })

    it('surfaces the disconnect failure untouched', async () => {
      const disconnectFailed = new Error('disconnect failed')
      const sdk = sdkAllowing({ disconnect: () => Promise.reject(disconnectFailed) })
      const actor = createActor(disconnectActor, { input: { sdk } })

      actor.subscribe({ error: () => {} })

      actor.start()
      await pause(0)

      expect(actor.getSnapshot().status).toBe('error')
      expect(actor.getSnapshot().error).toBe(disconnectFailed)

      actor.stop()
    })
  })
})
