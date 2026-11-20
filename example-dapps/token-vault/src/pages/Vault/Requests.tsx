import { formatFigure } from '@bootnodedev/canton-dappbooster'
import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react'
import { useState } from 'react'
import type { VaultBackend } from '@/backend/VaultBackend'
import { AmountDisplay } from '@/components/AmountDisplay'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { EmptyState } from '@/components/EmptyState'
import { Loading } from '@/components/Loading'
import { KIND_TEXT, SENT } from '@/pages/Vault/requestKind'
import { useVaultStore } from '@/store/useVaultStore'
import { cn } from '@/utils/cn'
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
  awaiting_allocation: 'bg-primary-soft text-primary-strong',
  awaiting_vault: 'bg-muted text-fg-muted',
  expired: 'bg-danger-soft text-danger',
  settling: 'bg-info-soft text-info',
}

const STAGES = ['Proposed', 'Accepted', 'Funded', 'Settled']

// The stage a row is waiting on; an expired request stopped at the stage it never reached.
const stageOf = (row: QueueRow): number => {
  if (row.stage === 'proposal') return 1
  return row.request.allocated ? 3 : 2
}

const dateTime = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  month: 'short',
})

const whenOf = (row: QueueRow): string => {
  if (row.stage === 'proposal') return 'Waiting for the vault to accept'
  const { allocateBefore, allocated, settleBefore } = row.request
  if (row.state === 'expired') return 'The window to finish it has closed'
  return allocated
    ? `Settles before ${dateTime.format(new Date(settleBefore))}`
    : `Fund before ${dateTime.format(new Date(allocateBefore))}`
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
  const current = stageOf(row)
  const expired = row.state === 'expired'
  return (
    <li className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] gap-x-3.5 gap-y-1 border-t border-border py-4 [grid-template-areas:'kind_main_action'_'kind_state_state'_'kind_track_track'] first:border-0 first:pt-1 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto_5.5rem] sm:[grid-template-areas:'kind_main_state_action'_'kind_track_track_track']">
      <span
        aria-hidden="true"
        className={cn(
          'grid size-10 place-items-center self-start rounded-xl [grid-area:kind]',
          row.kind === 'deposit'
            ? 'bg-[color-mix(in_oklab,var(--usdx)_16%,transparent)] text-[var(--usdx)]'
            : 'bg-[color-mix(in_oklab,var(--vsh)_16%,transparent)] text-[var(--vsh)]',
        )}
      >
        {row.kind === 'deposit' ? <ArrowDownToLine size={17} /> : <ArrowUpFromLine size={17} />}
      </span>
      <div className="min-w-0 [grid-area:main]">
        <div className="flex flex-wrap items-center gap-x-1.5 font-semibold text-fg">
          {KIND_TEXT[row.kind]}
          <AmountDisplay markSize="small" token={SENT[row.kind]} value={row.amount} />
        </div>
        <div className="text-[0.8rem] text-fg-soft">{whenOf(row)}</div>
      </div>
      <span
        className={cn(
          'inline-flex h-[1.375rem] items-center self-center justify-self-start whitespace-nowrap rounded-chip px-2.5 text-xs font-semibold [grid-area:state] max-sm:mt-1.5 sm:justify-self-end',
          STATE_TONE[row.state],
        )}
      >
        {STATE_TEXT[row.state]}
      </span>
      <span className="flex justify-end self-center [grid-area:action]">
        {row.action === 'none' ? null : (
          <Button
            aria-label={`${ACTION_TEXT[row.action]} the ${figureOf(row)}`}
            onClick={() => onAct(row)}
            pending={pending}
            size="sm"
            variant={row.action === 'cancel' ? 'secondary' : 'primary'}
          >
            {ACTION_TEXT[row.action]}
          </Button>
        )}
      </span>
      <ol
        aria-label={`${KIND_TEXT[row.kind]} progress`}
        className="mt-2.5 grid grid-cols-4 gap-1.5 [grid-area:track]"
      >
        {STAGES.map((stage, index) => (
          <li
            aria-current={index === current ? 'step' : undefined}
            className={cn(
              'flex flex-col gap-1.5 text-[0.7rem] font-semibold before:h-1 before:rounded-full before:content-[""]',
              index < current && 'text-fg-muted before:bg-primary',
              index === current &&
                (expired
                  ? 'text-danger before:bg-danger/50'
                  : 'text-fg before:bg-[linear-gradient(90deg,var(--primary)_50%,var(--bar-track)_50%)]'),
              index > current && 'text-fg-soft before:bg-[var(--bar-track)]',
            )}
            key={stage}
          >
            {stage}
          </li>
        ))}
      </ol>
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
  const toFund = rows.filter((row) => row.action === 'allocate').length

  return (
    <Card className="px-5 pt-5 pb-2 sm:px-6">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-heading text-base font-bold text-fg">Requests</h2>
        {toFund > 0 && <span className="text-[0.8rem] text-fg-muted">{toFund} to fund</span>}
      </div>
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
