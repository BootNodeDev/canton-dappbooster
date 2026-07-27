import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AmountDisplay } from '@/components/AmountDisplay'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { ClaimDialog } from '@/components/ClaimDialog'
import { ArrowLeftIcon, LockIcon } from '@/components/icons'
import { MilestoneTimeline } from '@/components/MilestoneTimeline'
import { Modal } from '@/components/Modal'
import { ScheduleCurve } from '@/components/ScheduleCurve'
import { StatusPill } from '@/components/StatusPill'
import { toast } from '@/components/toast'
import { useNow } from '@/lib/clock'
import { formatCC, formatDate, shortenParty } from '@/lib/format'
import { MIN_GRANT_AMOUNT } from '@/lib/schedule'
import { deriveGrant, useVesting, useVestingStore } from '@/store/useVestingStore'

const Stat = ({
  label,
  amount,
  tone,
}: {
  label: string
  amount: number
  tone?: string
}): React.JSX.Element => (
  <div className="rounded-xl border border-border bg-bg/40 p-4">
    <div className="text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-fg-muted">
      {label}
    </div>
    <AmountDisplay value={amount} className={`mt-1 text-lg font-semibold ${tone ?? 'text-fg'}`} />
  </div>
)

export const GrantDetailPage = (): React.JSX.Element => {
  const nowMs = useNow()
  const { id } = useParams<{ id: string }>()
  const { backend, partyId } = useVesting()
  const grant = useVestingStore((s) => s.grants.find((g) => g.id === id))
  const history = useVestingStore((s) => s.history)
  const withdraw = useVestingStore((s) => s.withdraw)
  const cancel = useVestingStore((s) => s.cancel)
  const [claimOpen, setClaimOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  if (grant === undefined) {
    return (
      <Card className="p-10 text-center">
        <h2 className="text-lg font-bold text-fg">Grant not found</h2>
        <p className="mt-1 text-sm text-fg-muted">It may have been fully claimed or cancelled.</p>
        <Button asLink to="/dashboard" size="sm" className="mt-4">
          Back to dashboard
        </Button>
      </Card>
    )
  }

  const derived = deriveGrant(grant, nowMs)
  const isReceiver = grant.receiver === partyId
  const isCreator = grant.creator === partyId
  const isMilestone = grant.schedule.curve.kind === 'milestone'
  const grantHistory = history.filter((h) => h.grantId === grant.id)
  const canClaim = derived.claimable >= MIN_GRANT_AMOUNT

  const onCancel = async (): Promise<void> => {
    setCancelling(true)
    try {
      await cancel(backend, partyId, grant.id)
      toast.success('Grant cancelled')
      setCancelOpen(false)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/dashboard"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-fg-muted transition-colors hover:text-fg"
      >
        <ArrowLeftIcon width={16} height={16} /> Back
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-fg">{grant.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusPill tone={isMilestone ? 'milestone' : 'linear'}>
              {isMilestone ? 'Milestone' : 'Linear'}
            </StatusPill>
            <StatusPill tone={derived.status === 'in_cliff' ? 'neutral' : 'success'}>
              {derived.status === 'in_cliff'
                ? 'In cliff'
                : derived.status === 'fully_vested'
                  ? 'Fully vested'
                  : 'Vesting'}
            </StatusPill>
          </div>
        </div>
        <div className="flex gap-2.5">
          {isReceiver &&
            (derived.status === 'in_cliff' ? (
              <span className="inline-flex items-center gap-1.5 self-center font-mono text-xs text-fg-muted">
                <LockIcon width={14} height={14} /> Locked until cliff
              </span>
            ) : (
              <Button disabled={!canClaim} onClick={() => setClaimOpen(true)}>
                Claim {formatCC(derived.claimable)} CC
              </Button>
            ))}
          {isCreator && (
            <Button variant="danger" onClick={() => setCancelOpen(true)}>
              Cancel grant
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Total" amount={grant.totalAmount} />
        <Stat label="Vested" amount={derived.vested} />
        <Stat label="Claimable" amount={derived.claimable} tone="text-success" />
        <Stat label="Claimed" amount={derived.claimed} tone="text-fg-muted" />
        <Stat label="Unvested" amount={derived.unvested} tone="text-fg-muted" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card className="p-6">
          <h2 className="text-sm font-extrabold text-fg">Vesting curve</h2>
          <div className="mt-4">
            <ScheduleCurve schedule={grant.schedule} nowMs={nowMs} />
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-sm font-extrabold text-fg">{isMilestone ? 'Milestones' : 'Terms'}</h2>
          <div className="mt-4">
            {isMilestone ? (
              <MilestoneTimeline
                schedule={grant.schedule}
                total={grant.totalAmount}
                nowMs={nowMs}
              />
            ) : (
              <dl className="flex flex-col gap-2.5 text-sm">
                {grant.schedule.curve.kind === 'linear' && (
                  <>
                    <div className="flex justify-between">
                      <dt className="text-fg-muted">Start</dt>
                      <dd className="font-mono text-fg">
                        {formatDate(grant.schedule.curve.start)}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-fg-muted">End</dt>
                      <dd className="font-mono text-fg">{formatDate(grant.schedule.curve.end)}</dd>
                    </div>
                  </>
                )}
                <div className="flex justify-between">
                  <dt className="text-fg-muted">Cliff</dt>
                  <dd className="font-mono text-fg">{formatDate(grant.schedule.cliff)}</dd>
                </div>
              </dl>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-sm font-extrabold text-fg">Parties</h2>
          <dl className="mt-4 flex flex-col gap-2.5 text-sm">
            {(
              [
                ['Provider', grant.provider],
                ['Funder', grant.creator],
                ['Receiver', grant.receiver],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="text-fg-muted">{label}</dt>
                <dd className="truncate font-mono text-xs text-fg">{shortenParty(value)}</dd>
              </div>
            ))}
          </dl>
          {grant.note !== undefined && (
            <p className="mt-4 border-t border-border pt-4 text-sm text-fg-muted">{grant.note}</p>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-sm font-extrabold text-fg">Withdraw history</h2>
          {grantHistory.length === 0 ? (
            <p className="mt-4 text-sm text-fg-muted">No withdrawals this session.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2.5">
              {grantHistory.map((h) => (
                <li key={h.id} className="flex items-center justify-between text-sm">
                  <span className="font-mono text-xs text-fg-muted">{formatDate(h.at)}</span>
                  <span className="font-mono font-semibold text-fg">{formatCC(h.amount)} CC</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {claimOpen && (
        <ClaimDialog
          open
          onClose={() => setClaimOpen(false)}
          title="Claim vested CC"
          available={derived.claimable}
          onConfirm={(amount) => withdraw(backend, partyId, grant.id, amount)}
        />
      )}

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel grant"
        description="Vested-but-unclaimed CC becomes a residual claim for the receiver; the contract is archived."
      >
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-bg/40 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-fg-muted">Returned to you</span>
              <AmountDisplay value={derived.unvested} className="font-semibold" />
            </div>
            <div className="mt-1.5 flex justify-between">
              <span className="text-fg-muted">Residual to receiver</span>
              <AmountDisplay value={derived.claimable} className="font-semibold" />
            </div>
          </div>
          <div className="flex justify-end gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCancelOpen(false)}
              disabled={cancelling}
            >
              Keep grant
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => void onCancel()}
              disabled={cancelling}
            >
              {cancelling ? 'Submitting…' : 'Cancel grant'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
