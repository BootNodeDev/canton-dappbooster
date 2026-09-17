import type { DisclosedContract } from '@/backend/wallet'
import { now } from '@/utils/clock'
import { SCAN_API_URL } from '@/utils/config'
import { errorText } from '@/utils/errorText'

// Flat, not nested under a `context` key: nesting fails preprocessing on the missing field.
export type AppTransferContext = {
  amuletRules: string
  featuredAppRight: null
  openMiningRound: string
}

type ScanContract = {
  contract_id: string
  created_event_blob: string
  template_id: string
}

type AmuletRulesResult = { amulet_rules_update?: { contract?: ScanContract; domain_id?: string } }

type RoundsResult = {
  open_mining_rounds?: Record<
    string,
    { contract?: ScanContract & { payload?: { opensAt?: string; round?: { number?: string } } } }
  >
}

const post = async <T>(path: string, body: Record<string, unknown>): Promise<T> => {
  const response = await fetch(`${SCAN_API_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    // A Scan that accepts and never answers would stack the 30-second network poll behind it.
    signal: AbortSignal.timeout(15_000),
  }).catch((error: unknown) => {
    throw new Error(`Scan unreachable for ${path}: ${errorText(error)}`)
  })
  if (!response.ok) {
    throw new Error(`Scan answered ${response.status} for ${path}`)
  }
  // Covers the html error page a stopped Scan is fronted by.
  return (await response.json().catch(() => {
    throw new Error(`Scan answered ${response.status} for ${path} with no JSON`)
  })) as T
}

const amuletRules = (): Promise<AmuletRulesResult> => post('/v0/amulet-rules', {})

const openRounds = (): Promise<RoundsResult> =>
  post('/v0/open-and-issuing-mining-rounds', {
    cached_issuing_round_contract_ids: [],
    cached_open_mining_round_contract_ids: [],
  })

const disclose = (contract: ScanContract): DisclosedContract => ({
  contractId: contract.contract_id,
  createdEventBlob: contract.created_event_blob,
  templateId: contract.template_id,
})

const liveRound = (rounds: RoundsResult): ScanContract | undefined => {
  const opened = now()
  return Object.values(rounds.open_mining_rounds ?? {})
    .map((entry) => entry.contract)
    .filter((contract) => contract !== undefined)
    .filter((contract) => Date.parse(contract.payload?.opensAt ?? '') <= opened)
    .sort((a, b) => Number(a.payload?.round?.number) - Number(b.payload?.round?.number))
    .at(-1)
}

export const fetchAppNetwork = async (): Promise<string | undefined> =>
  (await amuletRules()).amulet_rules_update?.domain_id

export const fetchTransferContext = async (): Promise<{
  ctx: AppTransferContext
  disclosed: DisclosedContract[]
  rulesTemplateId: string
}> => {
  const [rules, rounds] = await Promise.all([amuletRules(), openRounds()])
  const rulesContract = rules.amulet_rules_update?.contract
  const round = liveRound(rounds)
  // The SV opens the first round minutes after a LocalNet start; until then there is none to name.
  if (rulesContract === undefined || round === undefined) {
    throw new Error('Scan reported no AmuletRules and open mining round pair')
  }
  return {
    ctx: {
      amuletRules: rulesContract.contract_id,
      featuredAppRight: null,
      openMiningRound: round.contract_id,
    },
    disclosed: [rulesContract, round].map(disclose),
    // The split exercises AmuletRules directly rather than through the factory.
    rulesTemplateId: rulesContract.template_id,
  }
}
