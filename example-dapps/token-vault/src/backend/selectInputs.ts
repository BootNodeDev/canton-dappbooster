import {
  type Holding,
  type InstrumentId,
  parseAmount,
  tokenKey,
} from '@bootnodedev/canton-dappbooster'

type Candidate = { cid: string; scaled: bigint }

// Largest first so the command names as few inputs as it can, then by id so a read picks the same.
const byAmountDesc = (a: Candidate, b: Candidate): number => {
  if (a.scaled !== b.scaled) return a.scaled > b.scaled ? -1 : 1
  return a.cid < b.cid ? -1 : a.cid > b.cid ? 1 : 0
}

export const selectInputs = ({
  amount,
  holdings,
  instrumentId,
}: {
  amount: string
  holdings: readonly Holding[]
  instrumentId: InstrumentId
}): readonly string[] | undefined => {
  const target = parseAmount(amount)
  if (target === undefined || target <= 0n) return undefined

  const key = tokenKey(instrumentId)
  const candidates = holdings
    .filter((holding) => !holding.isLocked && tokenKey(holding.instrumentId) === key)
    .map((holding) => ({ cid: holding.contractId, scaled: parseAmount(holding.amount) }))
    .filter((one): one is Candidate => one.scaled !== undefined)
    .sort(byAmountDesc)

  const chosen: string[] = []
  let running = 0n
  for (const { cid, scaled } of candidates) {
    if (running >= target) break
    chosen.push(cid)
    running += scaled
  }
  return running >= target ? chosen : undefined
}
