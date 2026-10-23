import { Identifier } from '@bootnodedev/canton-dappbooster'
import { AmountDisplay } from '@/components/AmountDisplay'
import { headingClass } from '@/components/CreateGrant/fields'
import { LiveScheduleCurve } from '@/components/CreateGrant/LiveScheduleCurve'
import { type VestingSchedule, validVestingSchedule } from '@/utils/schedule'

interface PreviewProps {
  amount: string
  amountValid: boolean
  receiver: string
  schedule: VestingSchedule
}

// The last step: what will be signed, with the curve drawn against a live clock.
export const Preview = ({
  amount,
  amountValid,
  receiver,
  schedule,
}: PreviewProps): React.JSX.Element => (
  <>
    <h2 className={headingClass}>Preview</h2>
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
          className="font-mono text-xs text-fg"
          label="receiver party id"
          value={receiver}
        />
      )}
    </div>
    <div className="mt-5">
      {validVestingSchedule(schedule) ? (
        <LiveScheduleCurve schedule={schedule} />
      ) : (
        <div className="grid h-40 place-items-center rounded-xl border border-dashed border-border text-xs text-fg-muted">
          Enter a valid schedule to preview the curve
        </div>
      )}
    </div>
  </>
)
