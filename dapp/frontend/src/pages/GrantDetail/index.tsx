import { Identifier } from '@bootnodedev/canton-dappbooster'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AmountDisplay } from '@/components/AmountDisplay'
import { Button } from '@/components/Button'
import { CancelGrant } from '@/components/CancelGrant'
import { Card } from '@/components/Card'
import { Claim } from '@/components/Claim'
import { ConnectPrompt } from '@/components/ConnectPrompt'
import { GrantLock, GrantStatusPill } from '@/components/GrantStatus'
import { ScheduleCurve } from '@/components/ScheduleCurve'
import { StatusPill } from '@/components/StatusPill'
import { ArrowLeftIcon } from '@/icons'
import { MilestoneTimeline } from '@/pages/GrantDetail/MilestoneTimeline'
import { deriveGrant, grantLineage, useVesting, useVestingStore } from '@/store/useVestingStore'
import { useNow } from '@/utils/clock'
import { formatCC, formatDate } from '@/utils/format'
import { copyToast } from '@/utils/toast'

const Stat = ({
  label,
  amount,
  tone,
}: {
  label: string
  amount: string
  tone?: string
}): React.JSX.Element => (
  <div className="rounded-xl border border-border bg-bg/40 p-4">
    <div className="text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-fg-muted">
      {label}
    </div>
    <AmountDisplay value={amount} className={`mt-1 text-lg font-semibold ${tone ?? 'text-fg'}`} />
  </div>
)

export const GrantDetail = (): React.JSX.Element => {
  const nowMs = useNow()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { backend, partyId } = useVesting()
  const grant = useVestingStore((s) => s.grants.find((g) => g.id === id))
  const history = useVestingStore((s) => s.history)
  const withdraw = useVestingStore((s) => s.withdraw)
  const cancel = useVestingStore((s) => s.cancel)
  const [claimOpen, setClaimOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)

  if (backend === undefined) {
    return (
      <ConnectPrompt description="This grant is read from the ledger as your connected party." />
    )
  }

  if (grant === undefined) {
    return (
      <Card className="p-10 text-center">
        <h2 className="text-lg font-bold text-fg">Grant not found</h2>
        <p className="mt-1 text-sm text-fg-muted">It may have been fully claimed or cancelled.</p>
        <Button asLink to="/" size="sm" className="mt-4">
          Back to grants
        </Button>
      </Card>
    )
  }

  const derived = deriveGrant(grant, nowMs)
  const isReceiver = grant.receiver === partyId
  const isCreator = grant.creator === partyId
  const isMilestone = grant.schedule.curve.kind === 'milestone'
  const lineage = grantLineage(grant)
  const grantHistory = history.filter((h) => h.lineage === lineage)

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/"
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
            <GrantStatusPill status={derived.status} />
          </div>
        </div>
        <div className="flex gap-2.5">
          {isReceiver &&
            (derived.locked ? (
              <GrantLock
                status={derived.status === 'in_cliff' ? 'in_cliff' : 'not_started'}
                className="inline-flex items-center gap-1.5 self-center font-mono text-xs text-fg-muted"
              />
            ) : (
              <Button disabled={!derived.canClaim} onClick={() => setClaimOpen(true)}>
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
              <div key={label} className="flex items-center justify-between gap-3">
                <dt className="text-fg-muted">{label}</dt>
                <dd className="m-0 min-w-0">
                  <Identifier
                    value={value}
                    label={`${label.toLowerCase()} party id`}
                    announce={false}
                    onCopy={copyToast(`${label} party id`)}
                    className="text-xs"
                  />
                </dd>
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
        <Claim
          open
          onClose={() => setClaimOpen(false)}
          title="Claim vested CC"
          available={derived.claimable}
          onConfirm={async (amount) => {
            // The claim archives this contract and re-creates it, so the URL follows the successor.
            const next = await withdraw(backend, partyId, grant.id, amount)
            if (next !== undefined && next !== grant.id) {
              navigate(`/grants/${next}`, { replace: true })
            }
          }}
        />
      )}

      {cancelOpen && (
        <CancelGrant
          open
          onClose={() => setCancelOpen(false)}
          grant={grant}
          nowMs={nowMs}
          description="Vested-but-unclaimed CC becomes a residual claim for the receiver; the contract is archived."
          successMessage="Grant cancelled"
          onConfirm={async () => {
            // Cancel archives the grant for good, so staying here would read "Grant not found".
            await cancel(backend, partyId, grant.id)
            navigate('/', { replace: true })
          }}
        />
      )}
    </div>
  )
}
