import { NumberInput } from '@ark-ui/react/number-input'
import { Steps } from '@ark-ui/react/steps'
import {
  Identifier,
  isValidPartyId,
  type PartyIdError,
  PartyIdInput,
  TokenInput,
  type TokenMeta,
  validateAmount,
} from '@bootnodedev/canton-dappbooster'
import { Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AmountDisplay } from '@/components/AmountDisplay'
import { Button } from '@/components/Button'
import { DateField } from '@/components/CreateGrant/DateField'
import { atMidnight, dateOf, inputClass, labelClass } from '@/components/CreateGrant/fields'
import { LiveScheduleCurve } from '@/components/CreateGrant/LiveScheduleCurve'
import { FieldError } from '@/components/FieldError'
import { InfoTip } from '@/components/InfoTip'
import { Modal } from '@/components/Modal'
import { Pills } from '@/components/Pills'
import { Select } from '@/components/Select'
import { useParty } from '@/hooks/useParty'
import { useBackend } from '@/providers/Backend'
import { useVestingStore } from '@/store/useVestingStore'
import { compareAmounts } from '@/utils/amount'
import { now } from '@/utils/clock'
import { cn } from '@/utils/cn'
import { errorText } from '@/utils/errorText'
import { randomId } from '@/utils/randomId'
import { MIN_GRANT_AMOUNT, type VestingSchedule, validVestingSchedule } from '@/utils/schedule'
import { toast } from '@/utils/toast'
import { AMT } from '@/utils/tokens'

type CurveKind = 'linear' | 'milestone'

interface MilestoneInput {
  date: string
  id: string
  pct: string
}

interface DemoPreset {
  durationMs: number
  kind: CurveKind
}

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

const CURVES = [
  { value: 'linear', label: 'Linear' },
  { value: 'milestone', label: 'Milestone' },
] as const satisfies readonly { label: string; value: CurveKind }[]

const STEPS = ['Grant', 'Schedule', 'Preview']
const LAST_STEP = STEPS.length - 1

const panelClass = 'focus-visible:outline-none'

const stepClass =
  'flex w-full items-center rounded-[3px] py-1.5 focus-visible:outline-none focus-visible:shadow-[var(--ring)]'

const stepBarClass =
  'relative h-1.5 w-full rounded-[3px] bg-border ' +
  'before:absolute before:inset-0 before:origin-left before:scale-x-0 before:rounded-[3px] ' +
  'before:bg-primary before:transition-[scale,background-color] before:duration-500 ' +
  'before:ease-out before:content-[""] ' +
  'data-[complete]:before:scale-x-100 data-[complete]:before:bg-primary/40 ' +
  'data-[current]:before:scale-x-100'

const RECEIVER_MESSAGE: Record<PartyIdError, string> = {
  'missing-separator': 'Use a full party id (hint::fingerprint).',
  'invalid-hint': 'The hint before :: cannot be blank or contain spaces.',
  'invalid-fingerprint': 'The fingerprint after :: must be 68 hex characters.',
}

export const CreateGrant = ({ onClose }: { onClose: () => void }): React.JSX.Element => {
  const { party } = useParty()
  const { backend } = useBackend()
  const partyId = party?.partyId ?? ''
  const createVesting = useVestingStore((s) => s.createVesting)

  const [receiver, setReceiver] = useState('')
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
  const [step, setStep] = useState(0)
  const [balance, setBalance] = useState<string>()
  const [balanceState, setBalanceState] = useState<'loading' | 'error' | undefined>('loading')
  // The pick is display-only: a grant is Canton Coin whatever the field shows.
  const [token, setToken] = useState<TokenMeta>(AMT)

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

  const stepIsValid = (index: number): boolean =>
    index === 0 ? titleValid && receiverValid && amountValid : scheduleValid

  return (
    <Modal
      onClose={onClose}
      title="Create grant"
      className="max-h-[85vh] max-w-2xl overflow-y-auto"
    >
      <Steps.Root
        count={STEPS.length}
        isStepValid={stepIsValid}
        onStepChange={(details) => setStep(details.step)}
        step={step}
      >
        <Steps.List className="mb-3.5 flex gap-2">
          {STEPS.map((name, index) => (
            <Steps.Item className="flex-1" index={index} key={name}>
              <Steps.Trigger aria-label={name} className={stepClass}>
                <Steps.Indicator className={stepBarClass} />
              </Steps.Trigger>
            </Steps.Item>
          ))}
        </Steps.List>

        <Steps.Content index={0} className={panelClass}>
          <label htmlFor="title" className={labelClass}>
            Title
          </label>
          <input
            id="title"
            data-autofocus
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
              <TokenInput
                balance={balance}
                balanceState={balanceState}
                className="w-full border-0 p-0"
                id="amount"
                label="Total amount"
                onChange={setAmount}
                onTokenSelect={setToken}
                token={token}
                usdValue="N/A"
                value={amount}
              />
            </div>
          </div>
        </Steps.Content>

        <Steps.Content index={1} className={panelClass}>
          {step >= 1 && (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold text-fg">Schedule</h2>
                <Pills
                  label="Curve"
                  onChange={(kind) => editSchedule({ curveKind: kind })}
                  options={CURVES}
                  value={curveKind}
                  variant="segmented"
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={labelClass}>Demo duration</span>
                <InfoTip label={DEMO_DURATION_HINT} />
                <Select
                  className="ml-auto w-32"
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
                          <NumberInput.Root
                            className="w-20 shrink-0"
                            max={100}
                            min={0}
                            onValueChange={(details) => setMilestone(i, { pct: details.value })}
                            value={m.pct}
                          >
                            <NumberInput.Input
                              aria-label={`Milestone ${i + 1} cumulative percent`}
                              className={cn(inputClass, 'mt-0 font-mono')}
                            />
                          </NumberInput.Root>
                          <button
                            type="button"
                            aria-label={`Remove milestone ${i + 1}`}
                            onClick={() => editMilestones((l) => l.filter((_, idx) => idx !== i))}
                            disabled={milestones.length <= 1}
                            className="grid h-11 w-9 shrink-0 place-items-center text-danger disabled:opacity-40"
                          >
                            <Trash2 />
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
                  Schedule is invalid. Check that dates ascend, the cliff sits within the schedule,
                  and milestone percentages strictly increase to 100%.
                </p>
              )}
            </>
          )}
        </Steps.Content>

        <Steps.Content index={LAST_STEP} className={panelClass}>
          {step === LAST_STEP && (
            <>
              <h2 className="text-sm font-extrabold text-fg">Preview</h2>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-xs text-fg-muted">Total</span>
                <AmountDisplay
                  value={amountValid ? amount : '0'}
                  className="text-xl font-semibold"
                />
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xs text-fg-muted">Receiver</span>
                {receiver === '' ? (
                  <span className="font-mono text-xs text-fg">—</span>
                ) : (
                  <Identifier
                    className="font-mono text-xs text-fg"
                    label="receiver party id"
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
            </>
          )}
        </Steps.Content>

        <div className="mt-12 flex items-center gap-3">
          {step > 0 && (
            <Steps.PrevTrigger asChild>
              <Button variant="ghost" size="sm" className="px-0">
                Back
              </Button>
            </Steps.PrevTrigger>
          )}
          {step < LAST_STEP ? (
            <Steps.NextTrigger asChild>
              <Button className="ml-auto" size="sm" disabled={!stepIsValid(step)}>
                Continue
              </Button>
            </Steps.NextTrigger>
          ) : (
            <Button
              className="ml-auto"
              size="sm"
              disabled={!valid}
              pending={submitting}
              onClick={() => void submit()}
            >
              Create grant
            </Button>
          )}
        </div>
      </Steps.Root>
    </Modal>
  )
}
