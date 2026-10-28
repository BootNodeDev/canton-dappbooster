import { rpcErrors } from '@canton-network/core-rpc-errors'
import { describe, expect, it } from 'vitest'
import { ConnectCancelledError, toConnectError, toError } from '#src/connectError'

const rpcError = { code: -32000, message: 'wallet locked', data: { reason: 'locked' } }

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

  it("passes the SDK's JsonRpcError through untouched", () => {
    const failed = rpcErrors.transactionRejected(
      'Transaction with commandId claim-1 failed to execute.',
    )

    expect(toError(failed)).toBe(failed)
  })

  it('wraps a bare JSON-RPC object a custom adapter rejected with, keeping it as cause', () => {
    const error = toError(rpcError)

    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('wallet locked')
    expect(error.cause).toBe(rpcError)
  })

  it.each([
    ['an object without a message', { status: 'error', error: 3 }],
    ['an empty message', { message: '' }],
    ['a message that is not text', { message: 42 }],
    ['a string', 'nope'],
    ['null', null],
  ])('gives %s the fixed message, keeping it as cause', (_kind, rejected) => {
    const error = toError(rejected)

    expect(error.message).toBe('Wallet request failed')
    expect(error.cause).toBe(rejected)
  })
})
