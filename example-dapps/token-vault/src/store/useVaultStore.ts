import { useAccount } from '@bootnodedev/canton-connect'
import { useEffect } from 'react'
import { create } from 'zustand'
import type { VaultProposal, VaultRequest } from '@/backend/requests'
import type { VaultBackend } from '@/backend/VaultBackend'
import { useBackend } from '@/providers/Backend'
import { errorText } from '@/utils/errorText'

interface VaultState {
  error: string | undefined
  // Turns true once, so an empty queue is told apart from a first read: `loading` flips every poll.
  loaded: boolean
  loading: boolean
  proposals: readonly VaultProposal[]
  requests: readonly VaultRequest[]

  allocate: (backend: VaultBackend, partyId: string, request: VaultRequest) => Promise<void>
  cancel: (backend: VaultBackend, partyId: string, proposal: VaultProposal) => Promise<void>
  clear: () => void
  deposit: (backend: VaultBackend, partyId: string, amount: string) => Promise<void>
  refresh: (backend: VaultBackend, partyId: string) => Promise<void>
  withdraw: (backend: VaultBackend, partyId: string, amount: string) => Promise<void>
}

// Only the newest refresh may commit: a slow read for the previous party can resolve last.
let refreshEpoch = 0

// The vault accepts and settles backstage, so a row changes with nothing happening in this tab.
const POLL_MS = 5000

export const useVaultStore = create<VaultState>((set, get) => ({
  error: undefined,
  loaded: false,
  loading: false,
  proposals: [],
  requests: [],

  clear: () => {
    refreshEpoch++
    set({ error: undefined, loaded: false, loading: false, proposals: [], requests: [] })
  },

  refresh: async (backend, partyId) => {
    const epoch = ++refreshEpoch
    set({ error: undefined, loading: true })
    try {
      const { proposals, requests } = await backend.requestsOf(partyId)
      if (epoch !== refreshEpoch) return
      set({ loaded: true, loading: false, proposals, requests })
    } catch (err) {
      if (epoch !== refreshEpoch) return
      set({ error: errorText(err), loading: false })
    }
  },

  // A write re-reads rather than mutating a row: a proposal becomes a request under a new id.
  deposit: async (backend, partyId, amount) => {
    await backend.deposit(partyId, amount)
    await get().refresh(backend, partyId)
  },

  cancel: async (backend, partyId, proposal) => {
    await backend.cancelProposal(partyId, proposal)
    await get().refresh(backend, partyId)
  },

  withdraw: async (backend, partyId, amount) => {
    await backend.withdraw(partyId, amount)
    await get().refresh(backend, partyId)
  },

  allocate: async (backend, partyId, request) => {
    await backend.allocate(partyId, request)
    await get().refresh(backend, partyId)
  },
}))

// Once per page: a second caller is a second poll.
export const useVault = (): { backend: VaultBackend | undefined; partyId: string | undefined } => {
  const { backend } = useBackend()
  const { account } = useAccount()
  const partyId = account?.partyId
  const clear = useVaultStore((state) => state.clear)
  const refresh = useVaultStore((state) => state.refresh)

  useEffect(() => {
    if (backend === undefined || partyId === undefined) {
      clear()
      return
    }
    void refresh(backend, partyId)
    const timer = setInterval(() => void refresh(backend, partyId), POLL_MS)
    return () => clearInterval(timer)
  }, [backend, clear, partyId, refresh])

  return { backend, partyId }
}
