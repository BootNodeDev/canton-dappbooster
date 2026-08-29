// The AppTransferContext every Amulet-touching choice takes, built off wallet-service's
// `amulet.tap`. Scan supplied both contracts until devnet, where a browser can reach no Scan at all:
// the SV endpoints refuse the origin and the validator's scan-proxy wants a bearer.

import type { DisclosedContract } from '@/backend/wallet'
import { WALLET_RPC_URL } from '@/utils/config'

// tap is a pure builder: it returns the command it composed and submits nothing, so this mints no
// coin. `openRound` is read all the same, as which round the disclosures below belong to.
type TapResult = {
  commands?: { ExerciseCommand?: { choiceArgument?: { openRound?: string } } }
  disclosedContracts?: DisclosedContract[]
}

type RpcBody = { error?: { message?: string }; result?: unknown }

// Flat, not nested under a `context` key: nesting fails preprocessing on the missing field.
export type AppTransferContext = {
  amuletRules: string
  featuredAppRight: null
  openMiningRound: string
}

// Matched by suffix because the disclosures name a template by resolved package id, which differs
// per network and, on devnet, between the two entries.
const byTemplate = (disclosures: DisclosedContract[], entity: string): DisclosedContract[] =>
  disclosures.filter((disclosure) => disclosure.templateId.endsWith(entity))

// A refusal arrives either as wallet-service's own 200 carrying `error` or as the `/api/rpc`
// function's status, so `error.message` is read before the status and the reason survives both.
const rpc = async (method: string, params: Record<string, unknown>): Promise<unknown> => {
  const response = await fetch(WALLET_RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: '1', method, params }),
  })
  const body = (await response.json().catch(() => undefined)) as RpcBody | undefined
  const reason = body?.error?.message
  if (reason !== undefined) {
    throw new Error(`wallet-service refused ${method}: ${reason}`)
  }
  // Naming the status covers the html error page a stopped service is fronted by, and the 200
  // carrying neither member, which is just as unusable and would fail later as a bare TypeError.
  if (!response.ok || typeof body?.result !== 'object' || body.result === null) {
    throw new Error(`wallet-service answered ${response.status} for ${method}`)
  }
  return body.result
}

export const fetchTransferContext = async (
  party: string,
): Promise<{
  ctx: AppTransferContext
  disclosed: DisclosedContract[]
  rulesTemplateId: string
}> => {
  const result = (await rpc('amulet.tap', { receiver: party })) as TapResult
  const disclosures = result.disclosedContracts ?? []
  const amuletRules = byTemplate(disclosures, ':Splice.AmuletRules:AmuletRules').at(0)
  const rounds = byTemplate(disclosures, ':Splice.Round:OpenMiningRound')
  const chosen = result.commands?.ExerciseCommand?.choiceArgument?.openRound
  // The array is the registry's, so its order decides nothing here.
  const round = rounds.find((one) => one.contractId === chosen) ?? rounds.at(0)
  // The SV opens the first round minutes after a LocalNet start; until then tap cannot build.
  if (amuletRules === undefined || round === undefined) {
    throw new Error('wallet-service disclosed no AmuletRules and open mining round pair')
  }
  return {
    ctx: {
      amuletRules: amuletRules.contractId,
      openMiningRound: round.contractId,
      featuredAppRight: null,
    },
    // Rebuilt field by field to drop the wire object's `synchronizerId`, which `submit` stamps.
    disclosed: [amuletRules, round].map(({ templateId, contractId, createdEventBlob }) => ({
      templateId,
      contractId,
      createdEventBlob,
    })),
    // Carried for the split, which exercises AmuletRules directly rather than through a vesting
    // choice and so needs the resolved template id the filters deliberately do not use.
    rulesTemplateId: amuletRules.templateId,
  }
}
