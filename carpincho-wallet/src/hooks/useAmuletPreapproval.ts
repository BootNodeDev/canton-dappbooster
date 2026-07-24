import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import type { ExecutePreparedResponse } from '@/api/interactiveSubmission'
import {
  type AmuletPreapprovalActionParams,
  type AmuletPreapprovalStatus,
  cancelAmuletPreapproval,
  createAmuletPreapproval,
  getAmuletPreapprovalStatus,
} from '@/cip56/amuletPreapproval'
import type { AccountPublic } from '@/vault/types'
import type { VaultContextValue } from '@/vault/VaultContext'

export interface AmuletPreapprovalApi {
  getAmuletPreapprovalStatus: (receiver: string) => Promise<AmuletPreapprovalStatus>
  createAmuletPreapproval: (
    params: AmuletPreapprovalActionParams,
  ) => Promise<ExecutePreparedResponse>
  cancelAmuletPreapproval: (
    params: AmuletPreapprovalActionParams,
  ) => Promise<ExecutePreparedResponse>
}

export interface AmuletPreapprovalState {
  status?: AmuletPreapprovalStatus
  loading: boolean
  busy: boolean
  error?: string
  refresh: () => Promise<void>
  enable: () => Promise<void>
  disable: () => Promise<void>
}

export interface AmuletPreapprovalOptions {
  pollMs?: number | null
  api?: AmuletPreapprovalApi
  signMessage?: VaultContextValue['signMessage']
  recordTransaction?: VaultContextValue['recordTransaction']
}

const defaultApi: AmuletPreapprovalApi = {
  getAmuletPreapprovalStatus,
  createAmuletPreapproval,
  cancelAmuletPreapproval,
}

export const AMULET_PREAPPROVAL_POLL_MS = 5_000

// Polls the Amulet receiver preapproval contract because LocalNet has no browser stream for it.
export const useAmuletPreapproval = (
  account: AccountPublic | undefined,
  options: AmuletPreapprovalOptions = {},
): AmuletPreapprovalState => {
  const api = options.api ?? defaultApi
  const [actionBusy, setActionBusy] = useState(false)
  const pollMs = options.pollMs === undefined ? AMULET_PREAPPROVAL_POLL_MS : options.pollMs
  const query = useQuery({
    enabled: account !== undefined,
    queryKey: ['amulet', 'preapproval', account?.id, account?.partyId],
    queryFn: () => api.getAmuletPreapprovalStatus(account?.partyId ?? ''),
    refetchInterval: pollMs === null ? false : pollMs,
  })
  const error = query.error instanceof Error ? query.error.message : undefined

  const refresh = useCallback(async (): Promise<void> => {
    if (account === undefined) {
      return
    }
    await query.refetch()
  }, [account, query])

  const execute = useCallback(
    async (action: 'enable' | 'disable'): Promise<void> => {
      if (account === undefined) {
        throw new Error('no account selected')
      }
      if (options.signMessage === undefined || options.recordTransaction === undefined) {
        throw new Error('missing signing dependencies')
      }
      const params = {
        account,
        signMessage: options.signMessage,
        recordTransaction: options.recordTransaction,
      }
      setActionBusy(true)
      try {
        if (action === 'enable') {
          await api.createAmuletPreapproval(params)
        } else {
          await api.cancelAmuletPreapproval(params)
        }
        await query.refetch()
      } finally {
        setActionBusy(false)
      }
    },
    [account, api, options.signMessage, options.recordTransaction, query],
  )

  const enable = useCallback(async (): Promise<void> => {
    await execute('enable')
  }, [execute])

  const disable = useCallback(async (): Promise<void> => {
    await execute('disable')
  }, [execute])

  return useMemo(
    () => ({
      status: query.data,
      loading: query.isFetching,
      // Action-in-flight only, so poll refetches don't gate callers' input.
      busy: actionBusy,
      ...(error === undefined ? {} : { error }),
      refresh,
      enable,
      disable,
    }),
    [query.data, query.isFetching, actionBusy, error, refresh, enable, disable],
  )
}
