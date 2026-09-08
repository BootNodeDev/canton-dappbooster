import { Steps } from '@ark-ui/react/steps'
import { isValidPartyId, validateAmount } from '@bootnodedev/canton-dappbooster'
import { useState } from 'react'
import { Button } from '@/components/Button'
import { Details } from '@/components/CreateGrant/Details'
import { Preview } from '@/components/CreateGrant/Preview'
import { Schedule } from '@/components/CreateGrant/Schedule'
import { StepBar } from '@/components/CreateGrant/StepBar'
import {
  initialScheduleForm,
  type ScheduleForm,
  scheduleFormValid,
  shiftSchedule,
  toSchedule,
} from '@/components/CreateGrant/scheduleForm'
import { useFundingToken } from '@/components/CreateGrant/useFundingToken'
import { Modal } from '@/components/Modal'
import { useParty } from '@/hooks/useParty'
import { useBackend } from '@/providers/Backend'
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
  const { party } = useParty()
  const { backend } = useBackend()
  const partyId = party?.partyId ?? ''
  const createVesting = useVestingStore((s) => s.createVesting)
  const funding = useFundingToken()

  const [receiver, setReceiver] = useState('')
  const [amount, setAmount] = useState('')
  const [scheduleForm, setScheduleForm] = useState<ScheduleForm>(() =>
    initialScheduleForm(new Date(now())),
  )
  const [title, setTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [step, setStep] = useState(0)

  const schedule = toSchedule(scheduleForm)
  const scheduleValid = scheduleFormValid(scheduleForm)
  const amountValid =
    validateAmount(amount, { max: funding.balance }) === undefined &&
    amount !== '' &&
    compareAmounts(amount, MIN_GRANT_AMOUNT) >= 0
  const isSelf = party !== undefined && receiver === party.partyId
  const receiverValid = isValidPartyId(receiver) && !isSelf
  const titleValid = title.trim() !== ''

  const stepIsValid = (index: number): boolean =>
    index === 0 ? titleValid && receiverValid && amountValid : scheduleValid
  const valid = stepIsValid(0) && stepIsValid(1) && backend !== undefined

  const submit = async (): Promise<void> => {
    if (!valid || party === undefined || backend === undefined) {
      return
    }
    const { demo } = scheduleForm
    setSubmitting(true)
    try {
      await createVesting(backend, partyId, {
        proposer: partyId,
        receiver,
        totalAmount: amount,
        schedule: demo === null ? schedule : shiftSchedule(schedule, now() - demo.anchorMs),
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

  return (
    <Modal
      onClose={onClose}
      title="Create grant"
      className="max-h-[85vh] max-w-2xl overflow-y-auto"
    >
      {/* noValidate because the form reports its own errors; the native bubble would fire on Enter
          from an earlier step. */}
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
              title={title}
            />
          </Steps.Content>

          <Steps.Content index={1} className={panelClass}>
            {step === 1 && <Schedule onChange={setScheduleForm} value={scheduleForm} />}
          </Steps.Content>

          <Steps.Content index={LAST_STEP} className={panelClass}>
            {/* Mounted on its own step only, so the curve's clock does not tick behind a hidden
                panel. */}
            {step === LAST_STEP && (
              <Preview
                amount={amount}
                amountValid={amountValid}
                receiver={receiver}
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
