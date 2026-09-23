import type { v3_6_async } from '@canton-network/core-ledger-client-types'
import { describe, expect, it } from 'vitest'
import {
  CantonError,
  type CantonErrorPayload,
  cantonErrorPayloadOf,
  isRetryable,
} from '#src/cantonError'
import { toError } from '#src/connectError'

// Anything the spec describes must still fit the declared payload. One direction only: we widen
// the fields Canton sends as null and the spec types as string.
type SpecFits<T extends CantonErrorPayload> = T
type _SpecStillFits = SpecFits<v3_6_async.JsCantonError>

// Verbatim from the LocalNet participant on 2975, which sends null rather than omitting a field.
const payload: CantonErrorPayload = {
  code: 'INVALID_ARGUMENT',
  cause:
    'The submitted request has invalid arguments: filtersByParty and filtersForAnyParty cannot be empty simultaneously',
  correlationId: null,
  traceId: '9707c3da0d9d6ea2a4b79874e35156b6',
  context: {
    participant: 'app-user',
    definite_answer: 'false',
    tid: '9707c3da0d9d6ea2a4b79874e35156b6',
    category: '8',
  },
  errorCategory: 8,
  grpcCodeValue: 3,
  retryInfo: null,
  definiteAnswer: null,
}

const retryable: CantonErrorPayload = {
  ...payload,
  code: 'SEQUENCER_BACKPRESSURE',
  retryInfo: '1s',
}

// What HttpTransport rethrows once the gateway has wrapped a participant rejection: the parsed
// JSON-RPC body, whole.
const enveloped = (data?: unknown) => ({
  jsonrpc: '2.0',
  id: '39e3640c-0000-4000-8000-000000000000',
  error: { code: -32603, message: payload.cause, data },
})

// What the gateway sends for a resource outside its allowlist: a plain Error, so no data.
const unsupported = {
  jsonrpc: '2.0',
  id: '39e3640c-0000-4000-8000-000000000000',
  error: {
    code: -32603,
    message: 'Unsupported get resource: /v2/users/ledger-api-user/rights',
  },
}

// What WindowTransport rejects with: the error member alone, no envelope.
const bare = { code: -32603, message: payload.cause, data: payload }

const sdkError = {
  status: 'error',
  error: 3,
  details: 'Transaction with commandId claim-1 failed to execute.',
}

describe('cantonErrorPayloadOf', () => {
  it('finds the payload under the JSON-RPC envelope the gateway sends over HTTP', () => {
    expect(cantonErrorPayloadOf(enveloped(payload))).toBe(payload)
  })

  it('finds the payload under a bare error member, as the window transport rejects', () => {
    expect(cantonErrorPayloadOf(bare)).toBe(payload)
  })

  it('takes a payload handed to it directly', () => {
    expect(cantonErrorPayloadOf(payload)).toBe(payload)
  })

  it('refuses a rejection carrying no payload', () => {
    expect(cantonErrorPayloadOf(unsupported)).toBeUndefined()
    expect(cantonErrorPayloadOf(sdkError)).toBeUndefined()
    expect(cantonErrorPayloadOf('nope')).toBeUndefined()
  })

  it('refuses a payload missing the category the gateway keys its own wrapping on', () => {
    expect(cantonErrorPayloadOf({ code: 'INVALID_ARGUMENT', cause: 'bad request' })).toBeUndefined()
  })
})

describe('toError over the gateway', () => {
  it('reads the cause off an enveloped participant rejection instead of stringifying it', () => {
    const error = toError(enveloped(payload))

    expect(error).toBeInstanceOf(CantonError)
    expect(error.message).toBe(payload.cause)
  })

  it('keeps the participant code and the untouched payload on the error', () => {
    const error = toError(enveloped(payload)) as CantonError

    expect(error.code).toBe('INVALID_ARGUMENT')
    expect(error.errorCategory).toBe(8)
    expect(error.traceId).toBe('9707c3da0d9d6ea2a4b79874e35156b6')
    expect(error.payload).toBe(payload)
  })

  it('keeps the rejection the transport threw as the cause', () => {
    const rejection = enveloped(payload)

    expect(toError(rejection).cause).toBe(rejection)
  })

  it('reads the message off an envelope carrying no participant payload', () => {
    const error = toError(unsupported)

    expect(error).not.toBeInstanceOf(CantonError)
    expect(error.message).toBe('Unsupported get resource: /v2/users/ledger-api-user/rights')
  })

  it('still reads the details off an SDK controller rejection', () => {
    expect(toError(sdkError).message).toBe('Transaction with commandId claim-1 failed to execute.')
  })

  it('bounds a message a proxy in front of the participant supplied', () => {
    const error = toError({ error: { code: 502, message: '<html>'.repeat(200) } })

    expect(error.message).toHaveLength(200)
    expect(error.message.endsWith('…')).toBe(true)
  })
})

describe('isRetryable', () => {
  it('is true only where Canton itself sent retry guidance', () => {
    expect(isRetryable(toError(enveloped(retryable)))).toBe(true)
  })

  it('is false where Canton sent null rather than omitting the field', () => {
    expect(payload.retryInfo).toBeNull()
    expect(isRetryable(toError(enveloped(payload)))).toBe(false)
  })

  it('reports a null Canton field as absent rather than as null', () => {
    const error = toError(enveloped(payload)) as CantonError

    expect(error.retryInfo).toBeUndefined()
    expect(error.definiteAnswer).toBeUndefined()
  })

  it('is false for anything that is not a participant rejection', () => {
    expect(isRetryable(toError(unsupported))).toBe(false)
    expect(isRetryable(new Error('boom'))).toBe(false)
  })
})
