import { createContext, type ReactNode, useContext, useEffect, useState } from 'react'
import { createBackend, isDeployed, loadBackendConfig } from '@/backend/createBackend'
import type { VestingBackend } from '@/backend/VestingBackend'
import { MockWallet } from '@/mock/MockWallet'
import { StealthWallet } from '@/wallet/StealthWallet'
import type { Wallet } from '@/wallet/Wallet'

const BackendContext = createContext<VestingBackend | undefined>(undefined)

const mockBackend = (): VestingBackend =>
  createBackend({ rpcUrl: '', deployment: { pkg: '', operator: '' } }, new MockWallet())

export const BackendProvider = ({ children }: { children: ReactNode }): React.JSX.Element => {
  const [backend, setBackend] = useState<VestingBackend>(mockBackend)

  useEffect(() => {
    let cancelled = false

    void loadBackendConfig().then((config) => {
      if (cancelled) {
        return
      }
      const wallet: Wallet = isDeployed(config)
        ? new StealthWallet(config.rpcUrl)
        : new MockWallet()
      setBackend(createBackend(config, wallet))
    })

    return () => {
      cancelled = true
    }
  }, [])

  return <BackendContext.Provider value={backend}>{children}</BackendContext.Provider>
}

export const useBackend = (): VestingBackend => {
  const backend = useContext(BackendContext)
  if (backend === undefined) {
    throw new Error('useBackend must be used within a BackendProvider')
  }
  return backend
}
