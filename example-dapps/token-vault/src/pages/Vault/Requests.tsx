import { formatFigure } from '@bootnodedev/canton-dappbooster'
import { useState } from 'react'
import type { VaultBackend } from '@/backend/VaultBackend'
import { AmountDisplay } from '@/components/AmountDisplay'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { EmptyState } from '@/components/EmptyState'
import { Loading } from '@/components/Loading'
import { KIND_TEXT, SENT } from '@/pages/Vault/requestKind'
import { useVaultStore } from '@/store/useVaultStore'
import { errorText } from '@/utils/errorText'
import { type QueueRow, type QueueState, queueRows } from '@/utils/requestState'
import { toast } from '@/utils/toast'

const STATE_TEXT: Record<QueueState, string> = {
  awaiting_allocation: 'Waiting for your funds',
  awaiting_vault: 'Waiting for the vault',
  expired: 'Expired',
  settling: 'Funded, the vault is settling',
}

const STATE_TONE: Record<QueueState, string> = {
  awaiting_allocation: 'border-primary text-primary-strong',
  awaiting_vault: 'border-border-strong text-fg-muted',
  expired: 'border-danger text-danger',
  settling: 'border-border-strong text-fg',
}

const ACTION_TEXT = { allocate: 'Fund', cancel: 'Cancel' }

const figureOf = (row: QueueRow): string =>
  `${formatFigure(row.amount)} ${SENT[row.kind].symbol} ${row.kind}`

const Row = ({
  onAct,
  pending,
  row,
}: {
  onAct: (row: QueueRow) => void
  pending: boolean
  row: QueueRow
}): React.JSX.Element => {
  return (
    <li className="flex flex-wrap items-center gap-3 border-b border-border py-3 last:border-0">
      <span className="w-20 shrink-0 text-sm text-fg-muted">{KIND_TEXT[row.kind]}</span>
      <AmountDisplay className="text-sm font-bold" token={SENT[row.kind]} value={row.amount} />
      <span className={`rounded-full border px-2 py-0.5 text-xs ${STATE_TONE[row.state]}`}>
        {STATE_TEXT[row.state]}
      </span>
      <span className="ml-auto">
        {row.action === 'none' ? null : (
          <Button
            aria-label={`${ACTION_TEXT[row.action]} the ${figureOf(row)}`}
            onClick={() => onAct(row)}
            pending={pending}
            variant={row.action === 'cancel' ? 'secondary' : 'primary'}
          >
            {ACTION_TEXT[row.action]}
          </Button>
        )}
      </span>
    </li>
  )
}

export const Requests = ({
  backend,
  partyId,
}: {
  backend: VaultBackend
  partyId: string
}): React.JSX.Element => {
  const allocate = useVaultStore((state) => state.allocate)
  const cancel = useVaultStore((state) => state.cancel)
  const error = useVaultStore((state) => state.error)
  const loaded = useVaultStore((state) => state.loaded)
  const proposals = useVaultStore((state) => state.proposals)
  const requests = useVaultStore((state) => state.requests)
  const [acting, setActing] = useState<string>()

  const act = async (row: QueueRow): Promise<void> => {
    setActing(row.contractId)
    const figure = figureOf(row)
    try {
      if (row.stage === 'proposal') {
        await cancel(backend, partyId, row.proposal)
        toast.success(`Cancelled the ${figure}`)
      } else {
        await allocate(backend, partyId, row.request)
        toast.success(`Funded the ${figure}`)
      }
    } catch (err: unknown) {
      toast.error(errorText(err))
    } finally {
      setActing(undefined)
    }
  }

  if (!loaded && error === undefined) {
    return <Loading />
  }

  // Read at render: the windows run to the hour, so nothing here needs a ticking clock.
  const rows = queueRows({ proposals, requests }, Date.now())

  return (
    <Card className="p-5">
      <h2 className="mb-1 text-base font-bold">Requests</h2>
      {error !== undefined && (
        <p role="alert" className="mb-2 text-sm text-danger">
          {`Could not read the queue, so these rows may be stale. ${error}`}
        </p>
      )}
      {rows.length === 0 ? (
        <EmptyState
          title="No requests"
          description="A deposit or a withdraw shows up here until it settles."
        />
      ) : (
        <ul>
          {rows.map((row) => (
            <Row
              key={row.contractId}
              onAct={(one) => void act(one)}
              pending={acting === row.contractId}
              row={row}
            />
          ))}
        </ul>
      )}
    </Card>
  )
}
