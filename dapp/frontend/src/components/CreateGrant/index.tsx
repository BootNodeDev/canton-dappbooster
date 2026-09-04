import {
  Identifier,
  isValidPartyId,
  type PartyIdError,
  PartyIdInput,
  TokenInput,
  validateAmount,
} from '@bootnodedev/canton-dappbooster'
import { useEffect, useMemo, useState } from 'react'
import { AmountDisplay } from '@/components/AmountDisplay'
import { Button } from '@/components/Button'
import { ConnectPrompt } from '@/components/ConnectPrompt'
import { DateField } from '@/components/CreateGrant/DateField'
import { atMidnight, dateOf, inputClass, labelClass } from '@/components/CreateGrant/fields'
import { LiveScheduleCurve } from '@/components/CreateGrant/LiveScheduleCurve'
import { FieldError } from '@/components/FieldError'
import { InfoTip } from '@/components/InfoTip'
import { Modal } from '@/components/Modal'
import { Select } from '@/components/Select'
import { useParty } from '@/hooks/useParty'
import { TrashIcon } from '@/icons'
import { useBackend } from '@/providers/Backend'
import { useVestingStore } from '@/store/useVestingStore'
import { compareAmounts } from '@/utils/amount'
import { now } from '@/utils/clock'
import { cn } from '@/utils/cn'
import { errorText } from '@/utils/errorText'
import { randomId } from '@/utils/randomId'
import { MIN_GRANT_AMOUNT, type VestingSchedule, validVestingSchedule } from '@/utils/schedule'
import { copyToast, toast } from '@/utils/toast'
import { AMT } from '@/utils/tokens'

type CurveKind = 'linear' | 'milestone'

interface MilestoneInput {
  date: string
  id: string
  pct: string
}

// A demo preset; the actual schedule is re-anchored to submit time (see submit()).
interface DemoPreset {
  durationMs: number
  kind: CurveKind
}

// One state for the whole schedule, because no edit touches only one field: every manual one also
// has to clear `demo`, and a preset rewrites most of the rest.
interface ScheduleForm {
  cliff: string
  curveKind: CurveKind
  demo: DemoPreset | null
  end: string
  milestones: MilestoneInput[]
  start: string
}

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

const DEMO_DURATION_HINT = 'Schedule will be compressed into the selected amount of time'
const PRESETS = [
  { value: 'none', label: 'Real time' },
  { value: '60000', label: '1 min' },
  { value: '120000', label: '2 min' },
  { value: '300000', label: '5 min' },
  { value: '600000', label: '10 min' },
]

// The kit ships codes, not copy, so the wording is the app's. Exhaustive by construction: a new
// code stops this compiling rather than rendering nothing.
const RECEIVER_MESSAGE: Record<PartyIdError, string> = {
  'missing-separator': 'Use a full party id (hint::fingerprint).',
  'invalid-hint': 'The hint before :: cannot be blank or contain spaces.',
  'invalid-fingerprint': 'The fingerprint after :: must be 68 hex characters.',
}

export const CreateGrant = ({ onClose }: { onClose: () => void }): React.JSX.Element => {
  const { party } = useParty()
  // Not `useVesting`: this mounts over a page that already holds the ACS read, and a second one
  // would bump the refresh epoch and discard the page's own read mid-flight.
  const { backend } = useBackend()
  const partyId = party?.partyId ?? ''
  const createVesting = useVestingStore((s) => s.createVesting)

  const [receiver, setReceiver] = useState('')
  // What the field is currently flagging: the kit reports it, this page words and places it.
  const [receiverError, setReceiverError] = useState<PartyIdError | undefined>(undefined)
  const [amount, setAmount] = useState('')
  const [scheduleForm, setScheduleForm] = useState<ScheduleForm>(() => ({
    curveKind: 'linear',
    ...defaultSchedule(new Date(now())),
    demo: null,
  }))
  const { curveKind, cliff, start, end, milestones, demo } = scheduleForm
  const [title, setTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [step, setStep] = useState(1)
  const [balance, setBalance] = useState<string>()
  const [balanceState, setBalanceState] = useState<'loading' | 'error' | undefined>('loading')

  // Read once on mount rather than kept live: nothing this form does moves the funder's coin, and a
  // ceiling that shifted under a half-typed amount would reject what the user was told to enter.
  useEffect(() => {
    if (backend === undefined || partyId === '') {
      return
    }
    let live = true
    backend.balanceOf(partyId).then(
      (value) => {
        if (live) {
          setBalance(value)
          setBalanceState(undefined)
        }
      },
      () => {
        if (live) {
          setBalanceState('error')
        }
      },
    )
    return () => {
      live = false
    }
  }, [backend, partyId])

  const editReceiver = (value: string, error: PartyIdError | undefined): void => {
    setReceiver(value)
    setReceiverError(error)
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
  // Recomputed rather than stored from the last keystroke, so it can never outlive the value that
  // produced it, and so a balance that lands after the amount was typed still applies. Same call
  // the field makes internally, which is what keeps the Continue button and its border in step.
  const amountError = validateAmount(amount, { max: balance })
  const aboveFloor = amount !== '' && compareAmounts(amount, MIN_GRANT_AMOUNT) >= 0
  const amountValid = amountError === undefined && aboveFloor
  const receiverWellFormed = isValidPartyId(receiver)
  const isSelf = party !== undefined && receiver === party.partyId
  const receiverValid = receiverWellFormed && !isSelf

  const receiverMessage =
    receiverError !== undefined
      ? RECEIVER_MESSAGE[receiverError]
      : isSelf
        ? 'Cannot grant to your own party.'
        : undefined
  const titleValid = title.trim() !== ''
  const valid = scheduleValid && amountValid && receiverValid && titleValid && backend !== undefined

  // Any manual schedule edit drops the demo flag so the entered dates are used verbatim, which is
  // why every one of them goes through here.
  const editSchedule = (patch: Partial<ScheduleForm>): void =>
    setScheduleForm((current) => ({ ...current, ...patch, demo: null }))
  const editMilestones = (update: (list: MilestoneInput[]) => MilestoneInput[]): void =>
    setScheduleForm((current) => ({
      ...current,
      milestones: update(current.milestones),
      demo: null,
    }))
  const setMilestone = (i: number, patch: Partial<MilestoneInput>): void =>
    editMilestones((list) => list.map((m, idx) => (idx === i ? { ...m, ...patch } : m)))

  // The fields are filled from buildDemoSchedule rather than rebuilt here, or the preview and the
  // submitted schedule are two copies of the same step maths and drift apart. 'none' restores the
  // default months-out schedule.
  const applyPreset = (value: string): void => {
    if (value === 'none') {
      setScheduleForm((current) => ({
        curveKind: current.curveKind,
        ...defaultSchedule(new Date(now())),
        demo: null,
      }))
      return
    }
    const preset: DemoPreset = { kind: curveKind, durationMs: Number(value) }
    const built = buildDemoSchedule(preset, now())
    setScheduleForm((current) => ({
      ...current,
      cliff: built.cliff,
      ...(built.curve.kind === 'linear'
        ? { start: built.curve.start, end: built.curve.end }
        : {
            milestones: built.curve.points.map((point, i) => ({
              id: `d${i + 1}`,
              date: point.time,
              pct: String(Math.round(point.fraction * 100)),
            })),
          }),
      demo: preset,
    }))
  }

  const submit = async (): Promise<void> => {
    if (!valid || party === undefined || backend === undefined) {
      return
    }
    // Re-anchor a demo preset to now, or its short window is mostly vested before the receiver
    // accepts.
    const finalSchedule = demo === null ? schedule : buildDemoSchedule(demo, now())
    setSubmitting(true)
    try {
      await createVesting(backend, partyId, {
        proposer: partyId,
        receiver,
        totalAmount: amount,
        schedule: finalSchedule,
        title: title.trim(),
      })
      onClose()
      toast.success('Grant created', {
        action: { label: 'View pending grants', to: '/pending?role=funder' },
      })
    } catch (err) {
      toast.error(errorText(err))
    } finally {
      setSubmitting(false)
    }
  }

  const stepValid = step === 1 ? titleValid && receiverValid && amountValid : scheduleValid

  return (
    <Modal
      onClose={onClose}
      title={`Create Grant (${step}/3)`}
      className="max-h-[85vh] max-w-2xl overflow-y-auto"
    >
      {step === 1 && (
        <>
          <label htmlFor="title" className={labelClass}>
            Title
          </label>
          <input
            id="title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What is this grant for?"
            className={inputClass}
          />
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
              {/* No `onTokenSelect` on purpose: the kit renders the symbol as a static mark
                  without it, and a picker over a one-entry list is a control that cannot do
                  anything. Restore it when a second instrument exists — see architecture.md. */}
              <TokenInput
                balance={balance}
                balanceState={balanceState}
                className="w-full border-0 p-0"
                id="amount"
                label="Total amount"
                onChange={setAmount}
                token={AMT}
                usdValue="N/A"
                value={amount}
              />
            </div>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-fg">Schedule</h2>
            <div className="inline-flex rounded-lg border border-border bg-surface p-1">
              {(['linear', 'milestone'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={curveKind === k}
                  onClick={() => editSchedule({ curveKind: k })}
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
            <span className={labelClass}>Demo duration</span>
            <InfoTip label={DEMO_DURATION_HINT} />
            <Select
              className="ml-auto"
              label="Demo duration"
              value={demo === null ? 'none' : String(demo.durationMs)}
              options={PRESETS}
              onChange={applyPreset}
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <DateField
              id="cliff"
              label="Cliff date"
              value={cliff}
              onChange={(iso) => editSchedule({ cliff: iso })}
              className="sm:col-span-2"
            />
            {curveKind === 'linear' ? (
              <>
                <DateField
                  id="start"
                  label="Start date"
                  value={start}
                  onChange={(iso) => editSchedule({ start: iso })}
                />
                <DateField
                  id="end"
                  label="End date"
                  value={end}
                  onChange={(iso) => editSchedule({ end: iso })}
                />
              </>
            ) : (
              <div className="sm:col-span-2">
                <span className={labelClass}>Milestones (date · cumulative %)</span>
                <p className="mt-1 text-xs text-fg-muted">
                  Percentages are cumulative and must end at 100%.
                </p>
                <div className="mt-2 flex flex-col gap-2">
                  {milestones.map((m, i) => (
                    <div key={m.id} className="flex gap-2">
                      <input
                        type="date"
                        aria-label={`Milestone ${i + 1} date`}
                        value={dateOf(m.date)}
                        onChange={(e) => setMilestone(i, { date: atMidnight(e.target.value) })}
                        className={cn(inputClass, 'mt-0 flex-1')}
                      />
                      <input
                        inputMode="numeric"
                        aria-label={`Milestone ${i + 1} cumulative percent`}
                        value={m.pct}
                        onChange={(e) =>
                          setMilestone(i, { pct: e.target.value.replace(/[^0-9]/g, '') })
                        }
                        className={cn(inputClass, 'mt-0 w-20 font-mono')}
                      />
                      <button
                        type="button"
                        aria-label={`Remove milestone ${i + 1}`}
                        onClick={() => editMilestones((l) => l.filter((_, idx) => idx !== i))}
                        disabled={milestones.length <= 1}
                        className="grid h-11 w-9 shrink-0 place-items-center text-danger disabled:opacity-40"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      editMilestones((l) => [
                        ...l,
                        {
                          id: randomId().slice(0, 8),
                          date: addMonths(new Date(now()), 24).toISOString(),
                          pct: '100',
                        },
                      ])
                    }
                    className="self-start text-xs font-bold text-primary-strong hover:underline"
                  >
                    + Add milestone
                  </button>
                </div>
              </div>
            )}
          </div>
          {!scheduleValid && (
            <p className="mt-3 text-xs text-danger">
              Schedule is invalid. Check that dates ascend, the cliff sits within the schedule, and
              milestone percentages strictly increase to 100%.
            </p>
          )}
        </>
      )}

      {step === 3 && (
        <>
          <h2 className="text-sm font-extrabold text-fg">Preview</h2>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-xs text-fg-muted">Total</span>
            <AmountDisplay value={amountValid ? amount : '0'} className="text-xl font-semibold" />
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xs text-fg-muted">Receiver</span>
            {receiver === '' ? (
              <span className="font-mono text-xs text-fg">—</span>
            ) : (
              <Identifier
                announce={false}
                className="font-mono text-xs text-fg"
                label="receiver party id"
                onCopy={copyToast('Party id')}
                value={receiver}
              />
            )}
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

          {backend === undefined ? (
            <div className="mt-6">
              <ConnectPrompt />
            </div>
          ) : (
            <p className="mt-5 text-xs text-fg-muted">
              The receiver must accept the grant to activate it.
            </p>
          )}
        </>
      )}

      <div className="mt-12 flex items-center gap-3">
        {step > 1 && (
          <Button variant="ghost" size="sm" className="px-0" onClick={() => setStep(step - 1)}>
            Back
          </Button>
        )}
        {step < 3 ? (
          <Button
            className="ml-auto"
            size="sm"
            disabled={!stepValid}
            onClick={() => setStep(step + 1)}
          >
            Continue
          </Button>
        ) : (
          backend !== undefined && (
            <Button
              className="ml-auto"
              size="sm"
              disabled={!valid}
              pending={submitting}
              onClick={() => void submit()}
            >
              Create grant
            </Button>
          )
        )}
      </div>
    </Modal>
  )
}
