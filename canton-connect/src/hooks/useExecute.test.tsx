import type { PrepareExecuteAndWaitResult } from '@canton-network/dapp-sdk'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useExecute } from '#src/hooks/useExecute'
import { testAccount } from '#src/testing/account'
import { FakeSessionProvider } from '#src/testing/fakeSession'
import type { Account, DappSdkMethods } from '#src/types'

const party = testAccount('alice::1220ab')

const executed: PrepareExecuteAndWaitResult = {
  tx: {
    status: 'executed',
    commandId: 'cmd-1',
    payload: { updateId: 'update-1', completionOffset: 42 },
  },
}

const liveSession = (
  prepareExecuteAndWait: DappSdkMethods['prepareExecuteAndWait'],
  connectedAccount: Account | undefined,
) => {
  const sdk: Partial<DappSdkMethods> = {
    prepareExecuteAndWait,
    onTxChanged: async () => undefined,
    removeOnTxChanged: async () => undefined,
  }

  return {
    wrapper: ({ children }: { children: ReactNode }) => (
      <FakeSessionProvider account={connectedAccount} sdk={sdk} status="connected">
        {children}
      </FakeSessionProvider>
    ),
  }
}

describe('useExecute', () => {
  it('fills actAs with the connected party when the caller sets none', async () => {
    const prepareExecuteAndWait = vi
      .fn<DappSdkMethods['prepareExecuteAndWait']>()
      .mockResolvedValue(executed)
    const { result } = renderHook(() => useExecute(), liveSession(prepareExecuteAndWait, party))

    await act(async () => {
      await result.current.execute({ commands: [] })
    })

    expect(prepareExecuteAndWait).toHaveBeenCalledWith({ commands: [], actAs: [party.partyId] })
  })

  it("leaves a caller's own actAs alone", async () => {
    const prepareExecuteAndWait = vi
      .fn<DappSdkMethods['prepareExecuteAndWait']>()
      .mockResolvedValue(executed)
    const { result } = renderHook(() => useExecute(), liveSession(prepareExecuteAndWait, party))

    await act(async () => {
      await result.current.execute({ commands: [], actAs: ['bob::1220cd'] })
    })

    expect(prepareExecuteAndWait).toHaveBeenCalledWith({ commands: [], actAs: ['bob::1220cd'] })
  })

  it('refuses a submit over a session that reports no account', async () => {
    const prepareExecuteAndWait = vi
      .fn<DappSdkMethods['prepareExecuteAndWait']>()
      .mockResolvedValue(executed)
    const { result } = renderHook(() => useExecute(), liveSession(prepareExecuteAndWait, undefined))

    await act(async () => {
      await expect(result.current.execute({ commands: [] })).rejects.toThrow(
        'wallet reports no primary account',
      )
    })

    expect(prepareExecuteAndWait).not.toHaveBeenCalled()
    expect(result.current.error).toBeUndefined()
  })
})
