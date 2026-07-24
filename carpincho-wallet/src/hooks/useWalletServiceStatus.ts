import { useCallback, useEffect, useState } from 'react'
import { type WalletServiceStatusResponse, walletServiceStatus } from '@/api/walletService'
import { useRuntimeConfig } from '@/config/useRuntimeConfig'

export interface WalletServiceStatus {
  connected: boolean
  networkId?: string
  reason?: string
}

interface UseWalletServiceStatusOptions {
  pollMs?: number | null
}

const DEFAULT_POLL_MS = 5000

// Converts the wallet-service status payload into the footer's binary Canton state.
const statusFromResponse = (status: WalletServiceStatusResponse): WalletServiceStatus => ({
  connected: status.connection?.isNetworkConnected === true,
  ...(status.network?.networkId === undefined ? {} : { networkId: status.network.networkId }),
  ...(status.connection?.networkReason === undefined
    ? {}
    : { reason: status.connection.networkReason }),
})

// Tracks whether wallet-service currently reports Canton network connectivity.
export const useWalletServiceStatus = (
  options: UseWalletServiceStatusOptions = {},
): WalletServiceStatus => {
  const { config } = useRuntimeConfig()
  const [status, setStatus] = useState<WalletServiceStatus>({ connected: false })
  const pollMs = options.pollMs === undefined ? DEFAULT_POLL_MS : options.pollMs

  // Probes the configured JSON-RPC endpoint and stores the current Canton connectivity result.
  const refresh = useCallback(async (): Promise<void> => {
    try {
      const response = await walletServiceStatus({ rpcUrl: config.walletServiceRpcUrl })
      setStatus(statusFromResponse(response))
    } catch (error) {
      setStatus({ connected: false, reason: (error as Error).message })
    }
  }, [config.walletServiceRpcUrl])

  useEffect(() => {
    void refresh()
    if (pollMs === null) {
      return undefined
    }
    const intervalId = window.setInterval(() => {
      void refresh()
    }, pollMs)
    return () => window.clearInterval(intervalId)
  }, [pollMs, refresh])

  return status
}
