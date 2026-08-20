import { describe, expect, it } from 'vitest'
import { ConnectCancelledError, toConnectError } from '#src/connectError'

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
})
