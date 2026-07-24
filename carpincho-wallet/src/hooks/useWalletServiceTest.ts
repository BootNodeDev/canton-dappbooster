import { useCallback, useRef, useState } from 'react'
import { walletServiceStatus } from '@/api/walletService'

export type WalletServiceTestState = 'idle' | 'testing' | 'connected' | 'unreachable'

export interface WalletServiceTest {
  state: WalletServiceTestState
  networkId?: string
  reason?: string
  testedUrl?: string
  test: (rpcUrl: string) => Promise<void>
}

// Probes a draft RPC URL (not the saved config) and exposes the result as gate state.
export const useWalletServiceTest = (): WalletServiceTest => {
  const [state, setState] = useState<WalletServiceTestState>('idle')
  const [networkId, setNetworkId] = useState<string | undefined>(undefined)
  const [reason, setReason] = useState<string | undefined>(undefined)
  const [testedUrl, setTestedUrl] = useState<string | undefined>(undefined)
  const seq = useRef(0)

  const test = useCallback(async (rpcUrl: string): Promise<void> => {
    seq.current += 1
    const ticket = seq.current
    setTestedUrl(rpcUrl)
    setState('testing')
    try {
      const status = await walletServiceStatus({ rpcUrl })
      if (ticket !== seq.current) {
        return
      }
      if (status.connection?.isNetworkConnected === true) {
        setNetworkId(status.network?.networkId)
        setReason(undefined)
        setState('connected')
      } else {
        setNetworkId(undefined)
        setReason(status.connection?.networkReason ?? 'Canton network not connected')
        setState('unreachable')
      }
    } catch (err) {
      if (ticket !== seq.current) {
        return
      }
      setNetworkId(undefined)
      setReason(err instanceof Error ? err.message : String(err))
      setState('unreachable')
    }
  }, [])

  return { state, networkId, reason, testedUrl, test }
}
