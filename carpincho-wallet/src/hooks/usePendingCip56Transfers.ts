import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import type { ExecutePreparedResponse } from '@/api/interactiveSubmission'
import {
  acceptPendingTransfer,
  listPendingIncomingTransfers,
  type PendingTokenTransfer,
} from '@/cip56/transfers'
import type { AccountPublic } from '@/vault/types'
import type { VaultContextValue } from '@/vault/VaultContext'

export interface Cip56TransferApi {
  listPendingIncomingTransfers: (partyId: string) => Promise<PendingTokenTransfer[]>
  acceptTransfer: (params: {
    account: AccountPublic
    transferInstructionCid: string
    signMessage: VaultContextValue['signMessage']
    recordTransaction: VaultContextValue['recordTransaction']
  }) => Promise<ExecutePreparedResponse>
}

export interface PendingCip56TransfersState {
  transfers: PendingTokenTransfer[]
  loading: boolean
  error?: string
  refresh: () => Promise<void>
  accept: (transferInstructionCid: string) => Promise<void>
}

export interface PendingCip56TransfersOptions {
  pollMs?: number | null
  api?: Cip56TransferApi
  signMessage?: VaultContextValue['signMessage']
  recordTransaction?: VaultContextValue['recordTransaction']
}

const defaultApi: Cip56TransferApi = {
  listPendingIncomingTransfers,
  acceptTransfer: acceptPendingTransfer,
}

export const CIP56_TRANSFER_POLL_MS = 5_000

// Polls pending incoming transfers because LocalNet exposes no browser stream for this flow.
export const usePendingCip56Transfers = (
  account: AccountPublic | undefined,
  options: PendingCip56TransfersOptions = {},
): PendingCip56TransfersState => {
  const api = options.api ?? defaultApi
  const pollMs = options.pollMs === undefined ? CIP56_TRANSFER_POLL_MS : options.pollMs
  const query = useQuery({
    enabled: account !== undefined,
    queryKey: ['cip56', 'incomingTransfers', account?.id, account?.partyId],
    queryFn: () => api.listPendingIncomingTransfers(account?.partyId ?? ''),
    refetchInterval: pollMs === null ? false : pollMs,
  })
  const transfers = query.data ?? []
  const error = query.error instanceof Error ? query.error.message : undefined

  const refresh = useCallback(async (): Promise<void> => {
    if (account === undefined) {
      return
    }
    await query.refetch()
  }, [account, query])

  const accept = useCallback(
    async (transferInstructionCid: string): Promise<void> => {
      if (account === undefined) {
        throw new Error('no account selected')
      }
      if (options.signMessage === undefined || options.recordTransaction === undefined) {
        throw new Error('missing signing dependencies')
      }
      await api.acceptTransfer({
        account,
        transferInstructionCid,
        signMessage: options.signMessage,
        recordTransaction: options.recordTransaction,
      })
      await query.refetch()
    },
    [account, api, options.signMessage, options.recordTransaction, query],
  )

  return useMemo(
    () => ({
      transfers,
      // Initial load only, so poll refetches don't flip the empty state.
      loading: query.isLoading,
      ...(error === undefined ? {} : { error }),
      refresh,
      accept,
    }),
    [transfers, query.isLoading, error, refresh, accept],
  )
}
