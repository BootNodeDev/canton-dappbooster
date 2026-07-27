import type { PartyRef, VestingBackend } from '@/backend/VestingBackend'
import { useWalletContext } from './WalletProvider'

// Hook surface kept stable across the mock→direct swap: components import
// useParty / useConnect. useParties exposes the pool + operator + availability for
// the picker; useBackend hands the store the active VestingBackend.

export interface UseConnectResult {
  connect: (party: PartyRef) => void
  disconnect: () => void
  isConnecting: boolean
  isConnected: boolean
}

export const useConnect = (): UseConnectResult => {
  const ctx = useWalletContext()
  return {
    connect: ctx.connect,
    disconnect: ctx.disconnect,
    isConnecting: ctx.isConnecting,
    isConnected: ctx.isConnected,
  }
}

export interface UsePartyResult {
  party: PartyRef | undefined
  isConnected: boolean
}

export const useParty = (): UsePartyResult => {
  const ctx = useWalletContext()
  return { party: ctx.party, isConnected: ctx.isConnected }
}

export interface UsePartiesResult {
  pool: PartyRef[]
  operator: string
  backendAvailable: boolean
}

export const useParties = (): UsePartiesResult => {
  const ctx = useWalletContext()
  return {
    pool: ctx.pool,
    operator: ctx.operator,
    backendAvailable: ctx.backendAvailable,
  }
}

export const useBackend = (): VestingBackend => useWalletContext().backend
