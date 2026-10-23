import { ConnectCancelledError } from '@bootnodedev/canton-connect'
import { describe, expect, it } from 'vitest'
import { isReportableConnectError } from '@/hooks/useConnectErrorToast'

describe('isReportableConnectError', () => {
  it('stays quiet when the user cancels the connect', () => {
    expect(isReportableConnectError(new ConnectCancelledError())).toBe(false)
  })

  it('reports a wallet that refused the connection', () => {
    expect(isReportableConnectError(new Error('Wallet did not connect'))).toBe(true)
  })

  it('reports an unrecognised failure rather than assuming a cancel', () => {
    expect(isReportableConnectError(new Error(''))).toBe(true)
    expect(isReportableConnectError(new Error('User closed the wallet picker'))).toBe(true)
  })
})
