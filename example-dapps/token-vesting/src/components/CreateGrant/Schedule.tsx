import { DateField } from '@/components/CreateGrant/DateField'
import { labelClass } from '@/components/CreateGrant/fields'
import { LiveScheduleCurve } from '@/components/CreateGrant/LiveScheduleCurve'
import { Milestones } from '@/components/CreateGrant/Milestones'
import {
  applyDemoPreset,
  type CurveKind,
  type ScheduleForm,
  scheduleFormValid,
  toSchedule,
} from '@/components/CreateGrant/scheduleForm'
import { InfoTip } from '@/components/InfoTip'
import { Pills } from '@/components/Pills'
import { Select } from '@/components/Select'
import { now } from '@/utils/clock'
import { cn } from '@/utils/cn'

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

interface ScheduleProps {
  onChange: (next: ScheduleForm) => void
  value: ScheduleForm
}

// When the grant vests: the curve, its dates, and the demo presets that compress them into minutes.
export const Schedule = ({ onChange, value }: ScheduleProps): React.JSX.Element => {
  const edit = (patch: Partial<ScheduleForm>): void => onChange({ ...value, ...patch })
  const { curveKind, cliff, start, end, milestones, demo } = value

  // A curve switch rebuilds the picked preset for the new shape rather than dropping it, so the
  // dates below stay compressed and the dropdown keeps saying what they are.
  const setCurve = (kind: CurveKind): void => {
    const next = { ...value, curveKind: kind }
    onChange(demo === null ? next : applyDemoPreset(next, String(demo.durationMs), now()))
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <span className={labelClass}>Schedule type</span>
          <Pills
            className="mt-1.5 flex w-full"
            label="Curve"
            onChange={setCurve}
            options={CURVES}
            value={curveKind}
            variant="segmented"
          />
        </div>
        <div>
          <span className={cn(labelClass, 'flex items-center gap-1.5')}>
            Demo duration
            <InfoTip label={DEMO_DURATION_HINT} />
          </span>
          <Select
            className="mt-1.5"
            label="Demo duration"
            value={demo === null ? 'none' : String(demo.durationMs)}
            options={PRESETS}
            onChange={(preset) => onChange(applyDemoPreset(value, preset, now()))}
          />
        </div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {curveKind === 'linear' ? (
          <>
            <DateField
              id="start"
              label="Start date"
              value={start}
              onChange={(iso) => edit({ start: iso })}
            />
            <DateField
              id="cliff"
              label="Cliff date"
              value={cliff}
              onChange={(iso) => edit({ cliff: iso })}
            />
            <DateField
              id="end"
              label="End date"
              value={end}
              onChange={(iso) => edit({ end: iso })}
            />
          </>
        ) : (
          <>
            <DateField
              id="cliff"
              label="Cliff date"
              value={cliff}
              onChange={(iso) => edit({ cliff: iso })}
            />
            <Milestones
              className="sm:col-span-3"
              onChange={(list) => edit({ milestones: list })}
              value={milestones}
            />
          </>
        )}
      </div>
      {scheduleFormValid(value) ? (
        <div className="mt-5 rounded-control border border-dashed border-border-strong bg-surface-2 px-4 pt-3 pb-2">
          <p className="mb-2 text-[0.8rem] font-semibold text-fg-muted">How it will vest</p>
          <LiveScheduleCurve compact schedule={toSchedule(value)} />
        </div>
      ) : (
        <p className="mt-3 text-xs text-danger">
          Schedule is invalid. Check that dates ascend, the cliff sits within the schedule, and
          milestone percentages strictly increase to 100%.
        </p>
      )}
    </>
  )
}
