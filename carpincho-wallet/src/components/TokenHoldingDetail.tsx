import { formatTokenAmount } from '@/cip56/amount'
import type { TokenHolding } from '@/cip56/holdings'
import { transferTimeLabel } from '@/cip56/transfers'
import { DetailRow } from '@/components/ui/DetailRow'

// Full detail for a single token holding UTXO.
export const TokenHoldingDetail = ({ holding }: { holding: TokenHolding }): JSX.Element => {
  const view = holding.interfaceViewValue
  const lock = view?.lock
  return (
    <dl className="grid gap-3">
      <DetailRow
        label="amount"
        value={view?.amount === undefined ? 'unknown' : formatTokenAmount(view.amount)}
      />
      <DetailRow
        label="lock"
        value={lock == null ? 'unlocked' : 'locked'}
      />
      {lock?.expiresAt === undefined ? null : (
        <DetailRow
          label="expires"
          value={transferTimeLabel(lock.expiresAt)}
        />
      )}
      <DetailRow
        label="contract id"
        value={holding.contractId}
        copyLabel="contract ID"
      />
    </dl>
  )
}
