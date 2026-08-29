// The AppTransferContext every Amulet-touching choice takes, built off wallet-service's
// `amulet.tap`. That method is a pure builder: it returns the command and its disclosures and
// submits nothing, so this mints no coin. Scan supplied both contracts until devnet, where no Scan
// is reachable from a browser — the SV endpoints refuse the origin and the validator's scan-proxy
// wants a bearer — and tap's disclosures already carry them.

import type { DisclosedContract } from '@/backend/wallet'
import { WALLET_RPC_URL } from '@/utils/config'

type TapDisclosure = { contractId: string; createdEventBlob: string; templateId: string }

// Flat, not nested under a `context` key: nesting fails preprocessing on the missing field.
export type AppTransferContext = {
  amuletRules: string
  featuredAppRight: null
  openMiningRound: string
}

// The templates are matched by suffix because the disclosures name them by resolved package id,
// which differs per network and between the two entries.
const suffix = (disclosures: TapDisclosure[], entity: string): TapDisclosure | undefined =>
  disclosures.find((disclosure) => disclosure.templateId.endsWith(entity))

// Status before parse: a stopped service or a proxy in front of it answers with an html error page,
// which would otherwise surface as a JSON syntax error naming nothing. A refusal, by contrast,
// arrives as a 200 carrying `error`.
const rpc = async (method: string, params: Record<string, unknown>): Promise<unknown> => {
  const response = await fetch(WALLET_RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: '1', method, params }),
  })
  if (!response.ok) {
    throw new Error(`wallet-service answered ${response.status} for ${method}`)
  }
  const body = (await response.json()) as { error?: { message?: string }; result?: unknown }
  if (body.error !== undefined) {
    throw new Error(`wallet-service refused ${method}: ${body.error.message ?? 'no reason given'}`)
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
  const result = (await rpc('amulet.tap', { receiver: party })) as {
    disclosedContracts?: TapDisclosure[]
  }
  const disclosures = result.disclosedContracts ?? []
  const amuletRules = suffix(disclosures, ':Splice.AmuletRules:AmuletRules')
  // The SV opens the first round minutes after a LocalNet start; until then tap cannot build.
  const round = suffix(disclosures, ':Splice.Round:OpenMiningRound')
  if (amuletRules === undefined || round === undefined) {
    throw new Error('wallet-service disclosed no AmuletRules and open mining round pair')
  }
  return {
    ctx: {
      amuletRules: amuletRules.contractId,
      openMiningRound: round.contractId,
      featuredAppRight: null,
    },
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
