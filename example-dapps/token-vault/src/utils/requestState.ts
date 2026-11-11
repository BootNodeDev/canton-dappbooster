// The one place a row's state and action are decided, so the badge and the button cannot disagree.

import type { RequestKind } from '@/backend/commands'
import type { VaultProposal, VaultRequest, VaultRequests } from '@/backend/requests'

export type QueueState = 'awaiting_allocation' | 'awaiting_vault' | 'expired' | 'settling'

type QueueAction = 'allocate' | 'cancel' | 'none'

export type QueueRow =
  | {
      action: 'cancel'
      amount: string
      contractId: string
      kind: RequestKind
      proposal: VaultProposal
      stage: 'proposal'
      state: 'awaiting_vault'
    }
  | {
      action: QueueAction
      amount: string
      contractId: string
      kind: RequestKind
      request: VaultRequest
      stage: 'request'
      state: QueueState
    }

// A deadline that will not parse stays open: the ledger says no rather than the queue hiding a row.
const passed = (deadline: string, nowMs: number): boolean => {
  const at = Date.parse(deadline)
  return !Number.isNaN(at) && nowMs >= at
}

export const requestState = (request: VaultRequest, nowMs: number): QueueState => {
  if (request.allocated) {
    return passed(request.settleBefore, nowMs) ? 'expired' : 'settling'
  }
  return passed(request.allocateBefore, nowMs) ? 'expired' : 'awaiting_allocation'
}

const requestRow = (request: VaultRequest, nowMs: number): QueueRow => {
  const state = requestState(request, nowMs)
  return {
    action: state === 'awaiting_allocation' ? 'allocate' : 'none',
    amount: request.amount,
    contractId: request.contractId,
    kind: request.kind,
    request,
    stage: 'request',
    state,
  }
}

const proposalRow = (proposal: VaultProposal): QueueRow => ({
  action: 'cancel',
  amount: proposal.amount,
  contractId: proposal.contractId,
  kind: proposal.kind,
  proposal,
  stage: 'proposal',
  state: 'awaiting_vault',
})

// The ACS carries no order; a request id carries its accept time, so this sorts newest first.
const byKeyDesc = (a: string, b: string): number => (a < b ? 1 : a > b ? -1 : 0)

export const queueRows = ({ proposals, requests }: VaultRequests, nowMs: number): QueueRow[] => [
  ...[...proposals]
    .sort((a, b) => byKeyDesc(a.contractId, b.contractId))
    .map((proposal) => proposalRow(proposal)),
  ...[...requests]
    .sort((a, b) => byKeyDesc(a.requestId, b.requestId))
    .map((request) => requestRow(request, nowMs)),
]
