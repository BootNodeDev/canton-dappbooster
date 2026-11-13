import { useAccount } from '@bootnodedev/canton-connect'
import { useEffect } from 'react'
import { create } from 'zustand'
import type { RequestKind } from '@/backend/commands'
import type { VaultProposal, VaultRequest } from '@/backend/requests'
import type { VaultBackend } from '@/backend/VaultBackend'
import { useBackend } from '@/providers/Backend'
import { errorText } from '@/utils/errorText'

interface VaultState {
  error: string | undefined
  // Turns true once, so an empty queue is told apart from a first read.
  loaded: boolean
  proposals: readonly VaultProposal[]
  requests: readonly VaultRequest[]

  allocate: (backend: VaultBackend, partyId: string, request: VaultRequest) => Promise<void>
  cancel: (backend: VaultBackend, partyId: string, proposal: VaultProposal) => Promise<void>
  clear: () => void
  propose: (
    backend: VaultBackend,
    partyId: string,
    kind: RequestKind,
    amount: string,
  ) => Promise<void>
  refresh: (backend: VaultBackend, partyId: string) => Promise<void>
}

// Only the newest refresh may commit: a slow read for the previous party can resolve last.
let refreshEpoch = 0

// The vault accepts and settles backstage, so a row changes with nothing happening in this tab.
const POLL_MS = 5000

export const useVaultStore = create<VaultState>((set, get) => ({
  error: undefined,
  loaded: false,
  proposals: [],
  requests: [],

  clear: () => {
    refreshEpoch++
    set({ error: undefined, loaded: false, proposals: [], requests: [] })
  },

  refresh: async (backend, partyId) => {
    const epoch = ++refreshEpoch
    try {
      const { proposals, requests } = await backend.requestsOf(partyId)
      if (epoch !== refreshEpoch) return
      set({ error: undefined, loaded: true, proposals, requests })
    } catch (err) {
      if (epoch !== refreshEpoch) return
      set({ error: errorText(err) })
    }
  },

  // A write re-reads rather than mutating a row: a proposal becomes a request under a new id.
  propose: async (backend, partyId, kind, amount) => {
    await backend.propose(partyId, kind, amount)
    await get().refresh(backend, partyId)
  },

  cancel: async (backend, partyId, proposal) => {
    await backend.cancelProposal(partyId, proposal)
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
