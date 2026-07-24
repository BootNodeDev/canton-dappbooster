import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { getToastEntries, toast } from '@/components/ui/toast'
import type { RuntimePendingRequest } from '@/extension/messages'
import type { AccountResolver, ProviderResponder } from '@/provider/types'
import type { AccountPublic } from '@/vault/types'
import { useExtensionRequests } from '@/views/home/useExtensionRequests'
import { useProviderRequestHandler } from '@/views/home/useProviderRequestHandler'
import { useWalletConnectLifecycle } from '@/views/home/useWalletConnectLifecycle'

const account = (overrides: Partial<AccountPublic> = {}): AccountPublic =>
  ({
    id: 'acc-1',
    name: 'bn-dev',
    partyId: 'bn-dev::1220abcd',
    network: 'canton:local',
    ...overrides,
  }) as unknown as AccountPublic

const makeResponder = (): {
  responder: ProviderResponder
  results: unknown[]
  errors: Array<{ code: number; message: string }>
} => {
  const results: unknown[] = []
  const errors: Array<{ code: number; message: string }> = []
  return {
    results,
    errors,
    responder: {
      result: async (value) => {
        results.push(value)
      },
      error: async (code, message) => {
        errors.push({ code, message })
      },
    },
  }
}

describe('useProviderRequestHandler', () => {
  afterEach(() => {
    cleanup()
    toast.clear()
  })

  const setup = (resolve: AccountResolver) => {
    const connects: Array<unknown> = []
    const signs: Array<unknown> = []
    const executes: Array<unknown> = []
    const { result } = renderHook(() =>
      useProviderRequestHandler(
        resolve,
        (v) => connects.push(v),
        (v) => signs.push(v),
        (v) => executes.push(v),
      ),
    )
    return { handler: result.current, connects, signs, executes }
  }

  it('bridges a connect request into pending-connect state with the origin', async () => {
    const { responder } = makeResponder()
    const { handler, connects, signs, executes } = setup(() => ({
      accounts: [account()],
      primary: account(),
    }))

    await handler({ method: 'connect', params: undefined }, responder, {
      origin: 'http://localhost:3012',
    })

    assert.equal(connects.length, 1)
    assert.deepEqual(connects[0], { origin: 'http://localhost:3012', responder })
    assert.equal(signs.length, 0)
    assert.equal(executes.length, 0)
  })

  it('bridges a sign-message approval into pending-sign state with the origin', async () => {
    const { responder, errors } = makeResponder()
    const { handler, signs, executes } = setup(() => ({ accounts: [account()], primary: null }))

    await handler({ method: 'signMessage', params: { message: 'bWVzc2FnZQ==' } }, responder, {
      origin: 'http://localhost:3012',
    })

    assert.equal(signs.length, 1)
    assert.deepEqual(signs[0], {
      account: account(),
      messageBase64: 'bWVzc2FnZQ==',
      origin: 'http://localhost:3012',
      responder,
    })
    assert.equal(executes.length, 0)
    assert.deepEqual(errors, [])
  })

  it('errors a sign request that is missing the message param', async () => {
    const { responder, errors } = makeResponder()
    const { handler, signs } = setup(() => ({ accounts: [account()], primary: null }))

    await handler({ method: 'signMessage', params: {} }, responder, {})

    assert.equal(signs.length, 0)
    assert.equal(errors[0]?.code, -32602)
  })

  it('errors a sign request when no account is available', async () => {
    const { responder, errors } = makeResponder()
    const { handler, signs } = setup(() => ({ accounts: [], primary: null }))

    await handler({ method: 'signMessage', params: { message: 'bWVzc2FnZQ==' } }, responder, {})

    assert.equal(signs.length, 0)
    assert.deepEqual(errors, [{ code: -32000, message: 'no account available' }])
  })

  it('bridges a prepare-execute approval into pending-execute state with normalized params', async () => {
    const { responder } = makeResponder()
    const { handler, executes } = setup(() => ({ accounts: [account()], primary: null }))

    await handler({ method: 'prepareExecute', params: { commands: [{ Create: {} }] } }, responder, {
      rawMethod: 'canton_prepareSignExecute',
    })

    assert.equal(executes.length, 1)
    const pending = executes[0] as {
      account: AccountPublic
      method: string
      rawMethod: string
      params: Record<string, unknown>
    }
    assert.equal(pending.method, 'prepareExecute')
    assert.equal(pending.rawMethod, 'canton_prepareSignExecute')
    // executeParams injects the acting party so the participant prepare has actAs/partyId.
    assert.equal(pending.params.partyId, account().partyId)
    assert.deepEqual(pending.params.actAs, [account().partyId])
  })

  it('does not create pending state for a directly-handled method', async () => {
    const { responder, results } = makeResponder()
    const { handler, signs, executes } = setup(() => ({ accounts: [account()], primary: null }))

    await handler({ method: 'disconnect', params: undefined }, responder, {})

    assert.equal(signs.length, 0)
    assert.equal(executes.length, 0)
    assert.deepEqual(results, [null])
  })
})

describe('useWalletConnectLifecycle', () => {
  afterEach(() => {
    cleanup()
    toast.clear()
  })

  it('is inert in extension mode (no sessions, proposals, or pairing)', async () => {
    let sessionsSet = 0
    let proposalSet = 0
    let handlerCalls = 0
    renderHook(() =>
      useWalletConnectLifecycle({
        extensionMode: true,
        handleProviderRequest: async () => {
          handlerCalls += 1
        },
        setSessions: () => (sessionsSet += 1),
        setProposal: () => (proposalSet += 1),
      }),
    )

    await new Promise((resolve) => setTimeout(resolve, 10))
    assert.equal(sessionsSet, 0)
    assert.equal(proposalSet, 0)
    assert.equal(handlerCalls, 0)
    assert.equal(getToastEntries().length, 0)
  })
})

// Minimal callback-style chrome.runtime fake that can serve the initial pending drain and emit
// live pending requests through the onMessage listener the hook registers.
const installChromeRuntime = (
  initialPending: RuntimePendingRequest[],
): { emit: (pending: RuntimePendingRequest) => void; restore: () => void } => {
  const listeners: Array<(message: unknown) => void> = []
  const original = (globalThis as { chrome?: unknown }).chrome
  ;(globalThis as { chrome?: unknown }).chrome = {
    runtime: {
      lastError: undefined,
      sendMessage: (message: { type: string }, cb: (response: unknown) => void) => {
        if (message.type === 'CARPINCHO_GET_PENDING_REQUESTS') {
          cb(initialPending)
          return
        }
        cb({})
      },
      onMessage: {
        addListener: (fn: (message: unknown) => void) => listeners.push(fn),
        removeListener: (fn: (message: unknown) => void) => {
          const i = listeners.indexOf(fn)
          if (i >= 0) listeners.splice(i, 1)
        },
      },
    },
  }
  return {
    emit: (pending) => {
      for (const fn of [...listeners]) fn({ type: 'CARPINCHO_PENDING_REQUEST', pending })
    },
    restore: () => {
      ;(globalThis as { chrome?: unknown }).chrome = original
    },
  }
}

const pending = (requestId: string, method = 'signMessage'): RuntimePendingRequest =>
  ({
    requestId,
    origin: 'http://localhost:3012',
    createdAt: 0,
    request: { id: 1, method, params: {} },
  }) as unknown as RuntimePendingRequest

describe('useExtensionRequests', () => {
  afterEach(() => {
    cleanup()
    toast.clear()
  })

  it('does nothing when not in extension mode', async () => {
    const chrome = installChromeRuntime([pending('a')])
    try {
      let calls = 0
      renderHook(() =>
        useExtensionRequests({
          extensionMode: false,
          handleProviderRequest: async () => {
            calls += 1
          },
        }),
      )
      await new Promise((resolve) => setTimeout(resolve, 10))
      assert.equal(calls, 0)
    } finally {
      chrome.restore()
    }
  })

  it('drains initial pending requests and de-duplicates by request id', async () => {
    const chrome = installChromeRuntime([pending('a')])
    try {
      const handled: string[] = []
      renderHook(() =>
        useExtensionRequests({
          extensionMode: true,
          handleProviderRequest: async (request) => {
            handled.push((request.params as { _id?: string })?._id ?? request.method)
          },
        }),
      )

      // Initial drain delivers request "a" exactly once.
      await waitFor(() => assert.equal(handled.length, 1))

      // Re-emitting the same request id over the live subscription is ignored.
      chrome.emit(pending('a'))
      await new Promise((resolve) => setTimeout(resolve, 10))
      assert.equal(handled.length, 1)

      // A new request id is handled.
      chrome.emit(pending('b'))
      await waitFor(() => assert.equal(handled.length, 2))
    } finally {
      chrome.restore()
    }
  })
})
