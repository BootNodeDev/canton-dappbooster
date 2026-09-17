import { describe, expect, it } from 'vitest'
import { ConnectCancelledError, toConnectError, toError } from '#src/connectError'

const rpcError = { code: -32000, message: 'wallet locked', data: { reason: 'locked' } }

const sdkError = {
  status: 'error',
  error: 3,
  details: 'Transaction with commandId claim-1 failed to execute.',
}

describe('toConnectError', () => {
  it('translates the picker dismissal, keeping the original as cause', () => {
    const dismissed = new Error('User closed the wallet picker')
    const error = toConnectError(dismissed)

    expect(error).toBeInstanceOf(ConnectCancelledError)
    expect(error.cause).toBe(dismissed)
  })

  it('passes a cancel a custom picker threw straight through', () => {
    const cancelled = new ConnectCancelledError()

    expect(toConnectError(cancelled)).toBe(cancelled)
  })

  it('leaves a wallet failure alone', () => {
    const failure = new Error('Wallet did not connect')

    expect(toConnectError(failure)).toBe(failure)
  })

  it('does not treat a near-miss message as a cancel', () => {
    expect(toConnectError(new Error('user closed the wallet picker'))).not.toBeInstanceOf(
      ConnectCancelledError,
    )
  })

  it('wraps a JSON-RPC error object rather than casting it', () => {
    const error = toConnectError(rpcError)

    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('wallet locked')
    expect(error.cause).toBe(rpcError)
  })
})

describe('toError', () => {
  it('leaves an Error untouched', () => {
    const failure = new Error('failure')

    expect(toError(failure)).toBe(failure)
  })

  it('wraps a JSON-RPC error object into an Error, keeping it as cause', () => {
    const error = toError(rpcError)

    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('wallet locked')
    expect(error.cause).toBe(rpcError)
  })

  it('reads the details off an SDK rejection instead of stringifying it', () => {
    const error = toError(sdkError)

    expect(error.message).toBe('Transaction with commandId claim-1 failed to execute.')
    expect(error.cause).toBe(sdkError)
  })

  it('prefers a message over a details when a rejection carries both', () => {
    expect(toError({ message: 'wallet locked', details: 'something else' }).message).toBe(
      'wallet locked',
    )
  })

  it('falls back to the details when the message is empty', () => {
    expect(toError({ message: '', details: 'the wallet refused' }).message).toBe(
      'the wallet refused',
    )
  })

  it('stringifies a rejection that carries no message', () => {
    expect(toError('nope').message).toBe('nope')
  })
})
