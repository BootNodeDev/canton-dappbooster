import {
  isValidPartyId,
  type PartyIdError,
  PartyIdInput,
  partyHint,
  TokenInput,
  validateAmount,
} from '@bootnodedev/canton-dappbooster'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AmountDisplay } from '@/components/AmountDisplay'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { FieldError } from '@/components/FieldError'
import { ScheduleCurve } from '@/components/ScheduleCurve'
import { toast } from '@/components/toast'
import { useParty } from '@/hooks/useParty'
import { useToken } from '@/hooks/useToken'
import { useTokenBalance } from '@/hooks/useTokenBalance'
import { useTokenPrice } from '@/hooks/useTokenPrice'
import { compareAmounts } from '@/lib/amount'
import { AMOUNT_ERROR_TEXT } from '@/lib/amountErrorText'
import { now, useNow } from '@/lib/clock'
import { cn } from '@/lib/cn'
import { errorText } from '@/lib/errorText'
import { formatUsdValue } from '@/lib/format'
import { MIN_GRANT_AMOUNT, type VestingSchedule, validVestingSchedule } from '@/lib/schedule'
import { FAVORITE_IDS } from '@/mock/tokens'
import { useVesting, useVestingStore } from '@/store/useVestingStore'

type CurveKind = 'linear' | 'milestone'

interface MilestoneInput {
  id: string
  date: string
  pct: string
}

// A demo preset; the actual schedule is re-anchored to submit time (see submit()).
interface DemoPreset {
  kind: CurveKind
  durationMs: number
}

// Schedule timestamps are full ISO so demo presets can build sub-day windows; the date inputs bind
// to the calendar-day part and reset the time to midnight when edited.
const dateOf = (iso: string): string => iso.slice(0, 10)
const atMidnight = (date: string): string => `${date}T00:00:00.000Z`
const relIso = (msFromNow: number): string => new Date(now() + msFromNow).toISOString()
const addMonths = (d: Date, m: number): Date => {
  const copy = new Date(d)
  copy.setMonth(copy.getMonth() + m)
  return copy
}

// The default months-out schedule, for a fresh form and for undoing a demo preset.
const defaultSchedule = (
  base: Date,
): { cliff: string; start: string; end: string; milestones: MilestoneInput[] } => ({
  cliff: addMonths(base, 3).toISOString(),
  start: base.toISOString(),
  end: addMonths(base, 24).toISOString(),
  milestones: [
    { id: 'm1', date: addMonths(base, 3).toISOString(), pct: '25' },
    { id: 'm2', date: addMonths(base, 9).toISOString(), pct: '60' },
    { id: 'm3', date: addMonths(base, 18).toISOString(), pct: '100' },
  ],
})

// Isolates the clock to the preview marker so typing in the form does not reconcile the whole page
// each tick.
const LiveScheduleCurve = ({ schedule }: { schedule: VestingSchedule }): React.JSX.Element => (
  <ScheduleCurve schedule={schedule} nowMs={useNow()} />
)

// Build a short demo schedule anchored at `anchorMs` (cliff = anchor, vests over duration).
const buildDemoSchedule = (preset: DemoPreset, anchorMs: number): VestingSchedule => {
  const at = (ms: number): string => new Date(anchorMs + ms).toISOString()
  if (preset.kind === 'linear') {
    return { cliff: at(0), curve: { kind: 'linear', start: at(0), end: at(preset.durationMs) } }
  }
  const step = preset.durationMs / 3
  return {
    cliff: at(0),
    curve: {
      kind: 'milestone',
      points: [
        { time: at(step), fraction: 0.34 },
        { time: at(step * 2), fraction: 0.67 },
        { time: at(preset.durationMs), fraction: 1 },
      ],
    },
  }
}

const labelClass = 'block text-xs font-bold uppercase tracking-[0.06em] text-fg-muted'
const inputClass =
  'mt-1.5 h-11 w-full rounded-xl border border-border bg-bg px-3 text-fg outline-none focus:shadow-[var(--ring)]'

// The kit ships codes, not copy, so the wording is the app's. Exhaustive by construction: a new
// code stops this compiling rather than rendering nothing.
const RECEIVER_MESSAGE: Record<PartyIdError, string> = {
  'missing-separator': 'Use a full party id (hint::fingerprint).',
  'invalid-hint': 'The hint before :: cannot be blank or contain spaces.',
  'invalid-fingerprint': 'The fingerprint after :: must be 68 hex characters.',
}

export const CreateGrantPage = (): React.JSX.Element => {
  const navigate = useNavigate()
  const { party } = useParty()
  const { backend, partyId } = useVesting()
  const createVesting = useVestingStore((s) => s.createVesting)
  const [token, setToken] = useToken()
  const { usdRate } = useTokenPrice(token)
  const {
    balance,
    isLoading: balanceLoading,
    error: balanceError,
  } = useTokenBalance(party?.partyId, token)
  const balanceState = balanceLoading ? 'loading' : balanceError !== undefined ? 'error' : undefined

  const today = new Date(now())
  const initial = defaultSchedule(today)
  const [receiver, setReceiver] = useState('')
  // What the field is currently flagging: the kit reports it, this page words and places it.
  const [receiverError, setReceiverError] = useState<PartyIdError | undefined>(undefined)
  const [amount, setAmount] = useState('')
  const [curveKind, setCurveKind] = useState<CurveKind>('linear')
  const [cliff, setCliff] = useState(initial.cliff)
  const [start, setStart] = useState(initial.start)
  const [end, setEnd] = useState(initial.end)
  const [milestones, setMilestones] = useState<MilestoneInput[]>(initial.milestones)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [disclosedBytes, setDisclosedBytes] = useState<number | null>(null)
  // When set, the schedule is a quick-demo preset and gets re-anchored to submit time.
  const [demo, setDemo] = useState<DemoPreset | null>(null)

  // Editing the grant's identity clears the created panel, restoring the submit button.
  const editReceiver = (value: string, error: PartyIdError | undefined): void => {
    setReceiver(value)
    setReceiverError(error)
    setDisclosedBytes(null)
  }
  const editAmount = (value: string): void => {
    setAmount(value)
    setDisclosedBytes(null)
  }

  const schedule = useMemo<VestingSchedule>(() => {
    if (curveKind === 'linear') {
      return { cliff, curve: { kind: 'linear', start, end } }
    }
    return {
      cliff,
      curve: {
        kind: 'milestone',
        points: milestones.map((m) => ({ time: m.date, fraction: Number(m.pct) / 100 })),
      },
    }
  }, [curveKind, cliff, start, end, milestones])

  const scheduleValid = validVestingSchedule(schedule)
  // The same bounds the field validates against, recomputed here rather than stored from the last
  // keystroke, so the message can never outlive the value that produced it.
  const amountError = validateAmount(amount, { max: balance?.total })
  const aboveFloor = amount !== '' && compareAmounts(amount, MIN_GRANT_AMOUNT) >= 0
  const amountValid = amountError === undefined && aboveFloor
  const amountMessage =
    amountError !== undefined
      ? AMOUNT_ERROR_TEXT[amountError]
      : amount !== '' && !aboveFloor
        ? `Minimum ${MIN_GRANT_AMOUNT} CC.`
        : undefined
  const receiverWellFormed = isValidPartyId(receiver)
  const isSelf = party !== undefined && receiver === party.partyId
  const receiverValid = receiverWellFormed && !isSelf

  const receiverMessage =
    receiverError !== undefined
      ? RECEIVER_MESSAGE[receiverError]
      : isSelf
        ? 'Cannot grant to your own party.'
        : undefined
  const valid = scheduleValid && amountValid && receiverValid

  // Any manual schedule edit drops the demo flag so the entered dates are used verbatim.
  const setMilestone = (i: number, patch: Partial<MilestoneInput>): void => {
    setDemo(null)
    setMilestones((list) => list.map((m, idx) => (idx === i ? { ...m, ...patch } : m)))
  }

  const demoLinear = (durationMs: number): void => {
    setCurveKind('linear')
    setStart(relIso(0))
    setCliff(relIso(0))
    setEnd(relIso(durationMs))
    setDemo({ kind: 'linear', durationMs })
  }
  const demoMilestones = (): void => {
    setCurveKind('milestone')
    setCliff(relIso(0))
    setMilestones([
      { id: 'd1', date: relIso(30_000), pct: '34' },
      { id: 'd2', date: relIso(60_000), pct: '67' },
      { id: 'd3', date: relIso(90_000), pct: '100' },
    ])
    setDemo({ kind: 'milestone', durationMs: 90_000 })
  }
  // Restore the default months-out schedule (undo a quick-demo preset).
  const resetSchedule = (): void => {
    const next = defaultSchedule(new Date(now()))
    setDemo(null)
    setCurveKind('linear')
    setStart(next.start)
    setCliff(next.cliff)
    setEnd(next.end)
    setMilestones(next.milestones)
  }

  const submit = async (): Promise<void> => {
    if (!valid || party === undefined) {
      return
    }
    // Re-anchor a demo preset to now, or its short window is mostly vested before the receiver
    // accepts.
    const finalSchedule = demo === null ? schedule : buildDemoSchedule(demo, now())
    const trimmedNote = note.trim()
    const title =
      trimmedNote !== ''
        ? trimmedNote.split(/[.\n]/)[0].slice(0, 60)
        : `Grant to ${partyHint(receiver)}`
    setSubmitting(true)
    try {
      const result = await createVesting(backend, partyId, {
        proposer: partyId,
        receiver,
        totalAmount: amount,
        schedule: finalSchedule,
        title,
        note: trimmedNote === '' ? undefined : trimmedNote,
      })
      setDisclosedBytes(result.disclosedBytes)
      toast.success(
        `Proposal created · delivered via explicit disclosure · ${result.disclosedBytes} bytes`,
      )
    } catch (err) {
      toast.error(errorText(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="flex flex-col gap-5">
        <Card className="p-6">
          <h2 className="text-sm font-extrabold text-fg">Receiver &amp; amount</h2>
          <div className="mt-4 flex gap-4 flex-col">
            <div>
              <label htmlFor="receiver" className={labelClass}>
                Receiver party id
              </label>
              <PartyIdInput
                aria-describedby={receiverMessage === undefined ? undefined : 'receiver-error'}
                aria-invalid={isSelf || undefined}
                className={cn(
                  inputClass,
                  'font-mono text-sm aria-invalid:border-danger aria-invalid:bg-danger-soft',
                )}
                id="receiver"
                onChange={editReceiver}
                placeholder="bob::1220…"
                value={receiver}
              />
              {receiverMessage !== undefined && (
                <FieldError id="receiver-error" message={receiverMessage} className="mt-1" />
              )}
            </div>
            <div>
              <TokenInput
                aria-describedby={amountMessage === undefined ? undefined : 'amount-error'}
                balance={balance?.total}
                balanceState={balanceState}
                className={'w-full'}
                favoriteIds={FAVORITE_IDS}
                id="amount"
                label="Total amount"
                onChange={editAmount}
                // Mock-first: the pick only relabels the field. Balance, validation and the grant
                // itself stay CC until real per-token balances land.
                onTokenSelect={setToken}
                usdValue={
                  usdRate === undefined || amount === ''
                    ? undefined
                    : formatUsdValue(amount, usdRate)
                }
                token={token}
                value={amount}
              />
              {amountMessage !== undefined && (
                <FieldError id="amount-error" message={amountMessage} className="mt-1" />
              )}
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-fg">Schedule</h2>
            <div className="inline-flex rounded-lg border border-border bg-surface p-1">
              {(['linear', 'milestone'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setDemo(null)
                    setCurveKind(k)
                  }}
                  className={cn(
                    'rounded-md px-3 py-1 text-xs font-bold capitalize transition-colors',
                    curveKind === k ? 'bg-primary-soft text-fg' : 'text-fg-muted hover:text-fg',
                  )}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.06em] text-fg-muted">
              Quick demo
            </span>
            <button
              type="button"
              onClick={() => demoLinear(60_000)}
              className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-fg-muted transition-colors hover:border-primary hover:text-primary"
            >
              Linear · 1 min
            </button>
            <button
              type="button"
              onClick={() => demoLinear(120_000)}
              className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-fg-muted transition-colors hover:border-primary hover:text-primary"
            >
              Linear · 2 min
            </button>
            <button
              type="button"
              onClick={demoMilestones}
              className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-fg-muted transition-colors hover:border-primary hover:text-primary"
            >
              Milestones · 90s
            </button>
            <button
              type="button"
              onClick={resetSchedule}
              className="ml-auto rounded-full px-3 py-1 text-xs font-semibold text-fg-muted underline-offset-2 transition-colors hover:text-fg hover:underline"
            >
              Reset
            </button>
          </div>
          {demo !== null && (
            <p className="mt-2 text-xs text-primary">
              Demo schedule — the window starts when you submit, so you have time to switch parties
              and accept before it fully vests.
            </p>
          )}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="cliff" className={labelClass}>
                Cliff date
              </label>
              <input
                id="cliff"
                type="date"
                value={dateOf(cliff)}
                onChange={(e) => {
                  setDemo(null)
                  setCliff(atMidnight(e.target.value))
                }}
                className={inputClass}
              />
            </div>
            {curveKind === 'linear' ? (
              <>
                <div>
                  <label htmlFor="start" className={labelClass}>
                    Start date
                  </label>
                  <input
                    id="start"
                    type="date"
                    value={dateOf(start)}
                    onChange={(e) => {
                      setDemo(null)
                      setStart(atMidnight(e.target.value))
                    }}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="end" className={labelClass}>
                    End date
                  </label>
                  <input
                    id="end"
                    type="date"
                    value={dateOf(end)}
                    onChange={(e) => {
                      setDemo(null)
                      setEnd(atMidnight(e.target.value))
                    }}
                    className={inputClass}
                  />
                </div>
              </>
            ) : (
              <div className="sm:col-span-2">
                <span className={labelClass}>Milestones (date · cumulative %)</span>
                <div className="mt-2 flex flex-col gap-2">
                  {milestones.map((m, i) => (
                    <div key={m.id} className="flex gap-2">
                      <input
                        type="date"
                        value={dateOf(m.date)}
                        onChange={(e) => setMilestone(i, { date: atMidnight(e.target.value) })}
                        className={cn(inputClass, 'mt-0 flex-1')}
                      />
                      <input
                        inputMode="numeric"
                        value={m.pct}
                        onChange={(e) =>
                          setMilestone(i, { pct: e.target.value.replace(/[^0-9]/g, '') })
                        }
                        className={cn(inputClass, 'mt-0 w-20 font-mono')}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setDemo(null)
                          setMilestones((l) => l.filter((_, idx) => idx !== i))
                        }}
                        disabled={milestones.length <= 1}
                        className="shrink-0 rounded-xl border border-border px-3 text-fg-muted transition-colors hover:border-danger hover:text-danger disabled:opacity-40"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setDemo(null)
                      setMilestones((l) => [
                        ...l,
                        {
                          id: crypto.randomUUID().slice(0, 8),
                          date: addMonths(today, 24).toISOString(),
                          pct: '100',
                        },
                      ])
                    }}
                    className="self-start text-xs font-bold text-primary hover:underline"
                  >
                    + Add milestone
                  </button>
                </div>
                <p className="mt-2 text-xs text-fg-muted">
                  Percentages are cumulative and must end at 100%.
                </p>
              </div>
            )}
          </div>
          {!scheduleValid && (
            <p className="mt-3 text-xs text-danger">
              Schedule is invalid. Check that dates ascend, the cliff sits within the schedule, and
              milestone percentages strictly increase to 100%.
            </p>
          )}
        </Card>

        <Card className="p-6">
          <label htmlFor="note" className={labelClass}>
            Note (optional)
          </label>
          <textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="What is this grant for?"
            className={cn(inputClass, 'h-auto resize-y py-2.5')}
          />
        </Card>
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <Card className="p-6">
          <h2 className="text-sm font-extrabold text-fg">Preview</h2>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-xs text-fg-muted">Total</span>
            <AmountDisplay value={amountValid ? amount : '0'} className="text-xl font-semibold" />
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xs text-fg-muted">Receiver</span>
            <span className="font-mono text-xs text-fg">
              {receiver === '' ? '—' : partyHint(receiver)}
            </span>
          </div>

          <div className="mt-5">
            {scheduleValid ? (
              <LiveScheduleCurve schedule={schedule} />
            ) : (
              <div className="grid h-40 place-items-center rounded-xl border border-dashed border-border text-xs text-fg-muted">
                Enter a valid schedule to preview the curve
              </div>
            )}
          </div>

          {disclosedBytes !== null ? (
            <div className="mt-6 rounded-xl border border-success/40 bg-success-soft p-4 text-center">
              <p className="text-sm font-bold text-fg">Proposal created</p>
              <p className="mt-1 font-mono text-xs text-success">
                delivered via explicit disclosure · {disclosedBytes} bytes
              </p>
              <Button size="sm" className="mt-3" onClick={() => navigate('/proposals')}>
                View proposals
              </Button>
            </div>
          ) : (
            <>
              <Button
                className="mt-6 w-full"
                disabled={!valid || submitting}
                onClick={() => void submit()}
              >
                {submitting ? 'Submitting…' : 'Create grant'}
              </Button>
              <p className="mt-2 text-center text-xs text-fg-muted">
                Creates a proposal via explicit disclosure; the receiver accepts to activate it.
              </p>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
