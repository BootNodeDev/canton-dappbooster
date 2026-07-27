import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AmountDisplay } from '@/components/AmountDisplay'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { ScheduleCurve } from '@/components/ScheduleCurve'
import { toast } from '@/components/toast'
import { now, useNow } from '@/lib/clock'
import { cn } from '@/lib/cn'
import { MIN_GRANT_AMOUNT, type VestingSchedule, validVestingSchedule } from '@/lib/schedule'
import { useVesting, useVestingStore } from '@/store/useVestingStore'
import { useParty } from '@/wallet/hooks'

type CurveKind = 'linear' | 'milestone'

interface MilestoneInput {
  id: string
  date: string // full ISO; the date input edits only the calendar-day part
  pct: string
}

// A demo preset; the actual schedule is re-anchored to submit time (see submit()).
interface DemoPreset {
  kind: CurveKind
  durationMs: number
}

// Schedule timestamps are full ISO strings so demo presets can build sub-day
// (seconds/minutes) windows; the date inputs bind to the day part and reset the
// time to midnight when edited.
const dateOf = (iso: string): string => iso.slice(0, 10)
const atMidnight = (date: string): string => `${date}T00:00:00.000Z`
const relIso = (msFromNow: number): string => new Date(now() + msFromNow).toISOString()
const addMonths = (d: Date, m: number): Date => {
  const copy = new Date(d)
  copy.setMonth(copy.getMonth() + m)
  return copy
}

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

export const CreateGrantPage = (): React.JSX.Element => {
  const nowMs = useNow()
  const navigate = useNavigate()
  const { party } = useParty()
  const { backend, partyId } = useVesting()
  const createVesting = useVestingStore((s) => s.createVesting)

  const today = new Date(now())
  const [receiver, setReceiver] = useState('')
  const [amount, setAmount] = useState('')
  const [curveKind, setCurveKind] = useState<CurveKind>('linear')
  const [cliff, setCliff] = useState(addMonths(today, 3).toISOString())
  const [start, setStart] = useState(today.toISOString())
  const [end, setEnd] = useState(addMonths(today, 24).toISOString())
  const [milestones, setMilestones] = useState<MilestoneInput[]>([
    { id: 'm1', date: addMonths(today, 3).toISOString(), pct: '25' },
    { id: 'm2', date: addMonths(today, 9).toISOString(), pct: '60' },
    { id: 'm3', date: addMonths(today, 18).toISOString(), pct: '100' },
  ])
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [disclosedBytes, setDisclosedBytes] = useState<number | null>(null)
  // When set, the schedule is a quick-demo preset and gets re-anchored to submit time.
  const [demo, setDemo] = useState<DemoPreset | null>(null)

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

  const amountNum = Number(amount)
  const scheduleValid = validVestingSchedule(schedule)
  const amountValid = Number.isFinite(amountNum) && amountNum >= MIN_GRANT_AMOUNT
  // Party ids are `hint::fingerprint`; both halves must be present, and a grant
  // to yourself is rejected (the ledger would refuse a self-vesting).
  const receiverWellFormed = /.+::.+/.test(receiver.trim())
  const isSelf = party !== undefined && receiver.trim() === party.partyId
  const receiverValid = receiverWellFormed && !isSelf
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
    const t = new Date(now())
    setDemo(null)
    setCurveKind('linear')
    setStart(t.toISOString())
    setCliff(addMonths(t, 3).toISOString())
    setEnd(addMonths(t, 24).toISOString())
    setMilestones([
      { id: 'm1', date: addMonths(t, 3).toISOString(), pct: '25' },
      { id: 'm2', date: addMonths(t, 9).toISOString(), pct: '60' },
      { id: 'm3', date: addMonths(t, 18).toISOString(), pct: '100' },
    ])
  }

  const submit = async (): Promise<void> => {
    if (!valid || party === undefined) {
      return
    }
    // Re-anchor a demo preset to NOW so its short window starts at submit, not when
    // the preset was clicked (otherwise it is mostly vested before the receiver accepts).
    const finalSchedule = demo === null ? schedule : buildDemoSchedule(demo, now())
    const trimmedNote = note.trim()
    const title =
      trimmedNote !== ''
        ? trimmedNote.split(/[.\n]/)[0].slice(0, 60)
        : `Grant to ${receiver.split('::')[0]}`
    setSubmitting(true)
    try {
      const result = await createVesting(backend, partyId, {
        proposer: partyId,
        receiver: receiver.trim(),
        totalAmount: amountNum,
        schedule: finalSchedule,
        title,
        note: trimmedNote === '' ? undefined : trimmedNote,
      })
      setDisclosedBytes(result.disclosedBytes)
      toast.success(
        `Proposal created · delivered via explicit disclosure · ${result.disclosedBytes} bytes`,
      )
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="flex flex-col gap-5">
        <Card className="p-6">
          <h2 className="text-sm font-extrabold text-fg">Receiver &amp; amount</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="receiver" className={labelClass}>
                Receiver party id
              </label>
              <input
                id="receiver"
                value={receiver}
                onChange={(e) => setReceiver(e.target.value)}
                placeholder="bob::1220…"
                className={cn(inputClass, 'font-mono text-sm')}
              />
              {receiver !== '' && !receiverWellFormed && (
                <p className="mt-1 text-xs text-danger">Use a full party id (hint::fingerprint).</p>
              )}
              {receiver !== '' && receiverWellFormed && isSelf && (
                <p className="mt-1 text-xs text-danger">Cannot grant to your own party.</p>
              )}
            </div>
            <div>
              <label htmlFor="amount" className={labelClass}>
                Total amount (CC)
              </label>
              <input
                id="amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="0"
                className={cn(inputClass, 'font-mono')}
              />
              {!amountValid && amount !== '' && (
                <p className="mt-1 text-xs text-danger">Minimum {MIN_GRANT_AMOUNT} CC.</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <span className={labelClass}>Funding</span>
              <p className="mt-1 text-xs text-fg-muted">
                Grants are unfunded — the amount is a plain on-ledger figure with no balance check.
              </p>
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

      {/* preview */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <Card className="p-6">
          <h2 className="text-sm font-extrabold text-fg">Preview</h2>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-xs text-fg-muted">Total</span>
            <AmountDisplay value={amountValid ? amountNum : 0} className="text-xl font-semibold" />
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xs text-fg-muted">Receiver</span>
            <span className="font-mono text-xs text-fg">
              {receiver === '' ? '—' : receiver.split('::')[0]}
            </span>
          </div>

          <div className="mt-5">
            {scheduleValid ? (
              <ScheduleCurve schedule={schedule} nowMs={nowMs} />
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
