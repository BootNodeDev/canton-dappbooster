// The AppTransferContext every Amulet-touching choice takes, read off Scan. Both endpoints are
// unauthenticated, so this runs without a wallet; the explorer origin is Scan's, API at /api/scan.

import type { DisclosedContract } from '@/backend/wallet'
import { EXPLORER } from '@/utils/config'

type ScanContract = { contract_id: string; created_event_blob: string; template_id: string }
type ScanRound = ScanContract & { payload: { opensAt: string; round: { number: string } } }
type ScanRules = ScanContract & { payload: { dso: string } }

// Flat, not nested under a `context` key: nesting fails preprocessing on the missing field.
export type AppTransferContext = {
  amuletRules: string
  featuredAppRight: null
  openMiningRound: string
}

// Status before parse: a Scan still starting answers with an nginx error page, which would
// otherwise surface as a JSON syntax error naming nothing.
const post = async (url: string, body: string): Promise<unknown> => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  })
  if (!response.ok) {
    throw new Error(`Scan answered ${response.status} for ${url}`)
  }
  return response.json()
}

export const fetchTransferContext = async (): Promise<{
  ctx: AppTransferContext
  disclosed: DisclosedContract[]
  dso: string
  rulesTemplateId: string
}> => {
  const scan = `${EXPLORER.baseUrl}/api/scan/v0`
  const [rules, rounds] = (await Promise.all([
    post(`${scan}/amulet-rules`, '{}'),
    post(
      `${scan}/open-and-issuing-mining-rounds`,
      '{"cached_open_mining_round_contract_ids":[],"cached_issuing_round_contract_ids":[]}',
    ),
  ])) as [
    { amulet_rules_update: { contract: ScanRules } },
    { open_mining_rounds: Record<string, { contract: ScanRound }> },
  ]
  const amuletRules = rules.amulet_rules_update.contract
  const round = Object.values(rounds.open_mining_rounds)
    .map((entry) => entry.contract)
    .filter((contract) => Date.parse(contract.payload.opensAt) <= Date.now())
    .sort((a, b) => Number(a.payload.round.number) - Number(b.payload.round.number))
    .at(-1)
  // The SV opens the first round minutes after a LocalNet start; until then nothing Amulet works.
  if (round === undefined) {
    throw new Error('Scan reports no open mining round yet — the network is still starting')
  }
  return {
    ctx: {
      amuletRules: amuletRules.contract_id,
      openMiningRound: round.contract_id,
      featuredAppRight: null,
    },
    disclosed: [amuletRules, round].map((contract) => ({
      templateId: contract.template_id,
      contractId: contract.contract_id,
      createdEventBlob: contract.created_event_blob,
    })),
    // Both carried for the split, which exercises AmuletRules directly rather than through a
    // vesting choice: `AmuletRules_Transfer` refuses a submission that does not name the DSO it
    // expects, and a command needs the resolved template id the filters deliberately do not use.
    dso: amuletRules.payload.dso,
    rulesTemplateId: amuletRules.template_id,
  }
}
