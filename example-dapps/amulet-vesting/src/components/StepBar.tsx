import { Steps } from '@ark-ui/react/steps'

const stepClass = 'flex w-full cursor-default items-center rounded-[3px] py-1.5 outline-none'

const stepBarClass =
  'relative h-1.5 w-full rounded-[3px] bg-border ' +
  'before:absolute before:inset-0 before:origin-left before:scale-x-0 before:rounded-[3px] ' +
  'before:bg-primary before:transition-[scale,background-color] before:duration-500 ' +
  'before:ease-out before:content-[""] ' +
  'data-[complete]:before:scale-x-100 data-[complete]:before:bg-primary/40 ' +
  'data-[current]:before:scale-x-100'

export const StepBar = ({ steps }: { steps: string[] }): React.JSX.Element => (
  <Steps.List className="mb-3.5 flex gap-2">
    {steps.map((name, index) => (
      <Steps.Item className="flex-1" index={index} key={name}>
        <Steps.Trigger aria-label={name} className={stepClass} tabIndex={-1}>
          <Steps.Indicator className={stepBarClass} />
        </Steps.Trigger>
      </Steps.Item>
    ))}
  </Steps.List>
)
