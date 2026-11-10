import { Steps } from '@ark-ui/react/steps'
import { validateAmount } from '@bootnodedev/canton-dappbooster'
import { useState } from 'react'
import { Button } from '@/components/Button'
import { Details } from '@/components/CreateGrant/Details'
import { Preview } from '@/components/CreateGrant/Preview'
import { Schedule } from '@/components/CreateGrant/Schedule'
import {
  initialScheduleForm,
  type ScheduleForm,
  scheduleFormValid,
  shiftSchedule,
  toSchedule,
} from '@/components/CreateGrant/scheduleForm'
import { useFundingToken } from '@/components/CreateGrant/useFundingToken'
import { Modal } from '@/components/Modal'
import { StepBar } from '@/components/StepBar'
import { useOnScreen } from '@/hooks/useOnScreen'
import { useReceiver } from '@/hooks/useReceiver'
import { useBackend } from '@/providers/Backend'
import { useSession } from '@/providers/Session'
import { useVestingStore } from '@/store/useVestingStore'
import { compareAmounts } from '@/utils/amount'
import { now } from '@/utils/clock'
import { errorText } from '@/utils/errorText'
import { MIN_GRANT_AMOUNT } from '@/utils/schedule'
import { toast } from '@/utils/toast'

const STEPS = ['Grant', 'Schedule', 'Preview']
const LAST_STEP = STEPS.length - 1

const panelClass = 'focus-visible:outline-none'

export const CreateGrant = ({ onClose }: { onClose: () => void }): React.JSX.Element => {
  const { session } = useSession()
  const { ready } = useBackend()
  const createVesting = useVestingStore((s) => s.createVesting)
  const funding = useFundingToken()

  const [receiver, setReceiver] = useState('')
  const [amount, setAmount] = useState('')
  const [scheduleForm, setScheduleForm] = useState<ScheduleForm>(() =>
    initialScheduleForm(new Date(now())),
  )
  const [title, setTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // `onClose` clears the one `?create=1` slot, which a newer dialog may hold once this lands.
  const onScreen = useOnScreen()
  const [step, setStep] = useState(0)

  const schedule = toSchedule(scheduleForm)
  const scheduleValid = scheduleFormValid(scheduleForm)
  const amountValid =
    validateAmount(amount, { max: funding.balance }) === undefined &&
    amount !== '' &&
    compareAmounts(amount, MIN_GRANT_AMOUNT) >= 0
  const resolved = useReceiver(receiver)
  const isSelf = session !== undefined && resolved.partyId === session.partyId
  const receiverValid = resolved.partyId !== undefined && !isSelf
  const titleValid = title.trim() !== ''

  const stepIsValid = (index: number): boolean =>
    index === 0 ? titleValid && receiverValid && amountValid : scheduleValid
  const valid = stepIsValid(0) && stepIsValid(1) && ready

  const submit = async (): Promise<void> => {
    if (!valid || session === undefined || resolved.partyId === undefined) {
      return
    }
    const { demo } = scheduleForm
    setSubmitting(true)
    try {
      await createVesting({
        receiver: resolved.partyId,
        totalAmount: amount,
        schedule: demo === null ? schedule : shiftSchedule(schedule, now() - demo.anchorMs),
        title: title.trim(),
      })
      toast.success('Grant created', {
        action: { label: 'View pending grants', to: '/pending?role=funder' },
      })
      if (onScreen.current) {
        onClose()
      }
    } catch (err) {
      toast.error(errorText(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      onClose={onClose}
      title="Create grant"
      className="max-h-[85vh] max-w-2xl overflow-y-auto"
    >
      {/* noValidate: the native bubble would fire on Enter from an earlier step. */}
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          if (step === LAST_STEP) {
            void submit()
          }
        }}
      >
        {/* linear so the bars cannot be clicked: Back and Continue are the only way through. */}
        <Steps.Root
          count={STEPS.length}
          isStepValid={stepIsValid}
          linear
          onStepChange={(details) => setStep(details.step)}
          step={step}
        >
          <StepBar steps={STEPS} />

          <Steps.Content index={0} className={panelClass}>
            <Details
              amount={amount}
              funding={funding}
              onAmountChange={setAmount}
              onReceiverChange={setReceiver}
              onTitleChange={setTitle}
              receiver={receiver}
              receiverIsSelf={isSelf}
              resolved={resolved}
              title={title}
            />
          </Steps.Content>

          <Steps.Content index={1} className={panelClass}>
            {step === 1 && <Schedule onChange={setScheduleForm} value={scheduleForm} />}
          </Steps.Content>

          <Steps.Content index={LAST_STEP} className={panelClass}>
            {/* Only on its own step, so the curve's clock never ticks behind a hidden panel. */}
            {step === LAST_STEP && (
              <Preview
                amount={amount}
                amountValid={amountValid}
                receiver={resolved.partyId ?? ''}
                receiverName={resolved.username}
                schedule={schedule}
              />
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
                type="submit"
              >
                Create grant
              </Button>
            )}
          </div>
        </Steps.Root>
      </form>
    </Modal>
  )
}
