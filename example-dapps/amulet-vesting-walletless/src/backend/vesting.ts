// Every call the vesting UI makes. None names a party: the server acts as the session's own,
// whatever a request says, so there is nothing to send.

import type { ClaimRecord, CreateVestInput, VestingView } from '#server/domain/types'
import { api } from '@/backend/api'

const cid = (contractId: string): string => encodeURIComponent(contractId)

export const vesting = {
  accept: async (pendingCid: string): Promise<void> => {
    await api(`/proposals/${cid(pendingCid)}/accept`, { method: 'POST' })
  },
  balance: async (): Promise<string> => (await api<{ free: string }>('/balance')).free,
  cancel: async (contractCid: string): Promise<void> => {
    await api(`/grants/${cid(contractCid)}/cancel`, { method: 'POST' })
  },
  claimHistory: (contractCid: string): Promise<ClaimRecord[]> =>
    api<ClaimRecord[]>(`/grants/${cid(contractCid)}/claims`),
  claimResidual: async (claimCid: string, amount: string): Promise<void> => {
    await api(`/claims/${cid(claimCid)}/withdraw`, { method: 'POST', body: { amount } })
  },
  createVesting: async (grant: CreateVestInput): Promise<void> => {
    await api('/grants', { method: 'POST', body: grant })
  },
  tap: async (): Promise<void> => {
    await api('/tap', { method: 'POST' })
  },
  view: (): Promise<VestingView> => api<VestingView>('/vesting'),
  withdraw: async (contractCid: string, amount: string): Promise<void> => {
    await api(`/grants/${cid(contractCid)}/withdraw`, { method: 'POST', body: { amount } })
  },
}

// The faucet's fixed amount, set by the server's tap command; one amount, so a tap is a button and
// not a form.
export const TAP_AMOUNT = '100'
