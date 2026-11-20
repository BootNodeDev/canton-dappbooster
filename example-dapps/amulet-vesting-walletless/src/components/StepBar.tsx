import { Steps } from '@ark-ui/react/steps'
import { cn } from '@/utils/cn'

const stepClass = 'flex w-full flex-col items-start gap-2 rounded-[3px] pt-1.5 outline-none'

const stepBarClass =
  'relative h-1 w-full rounded-[3px] bg-border ' +
  'before:absolute before:inset-0 before:origin-left before:scale-x-0 before:rounded-[3px] ' +
  'before:bg-primary before:transition-[scale,background-color] before:duration-500 ' +
  'before:ease-out before:content-[""] ' +
  'data-[complete]:before:scale-x-100 data-[complete]:before:bg-primary/45 ' +
  'data-[current]:before:scale-x-100'

interface StepBarProps {
  navigable?: boolean
  steps: string[]
}

export const StepBar = ({ navigable = false, steps }: StepBarProps): React.JSX.Element => (
  <Steps.List className="mb-6 flex gap-2">
    {steps.map((name, index) => (
      <Steps.Item className="group flex-1" index={index} key={name}>
        <Steps.Trigger
          className={cn(stepClass, navigable ? 'cursor-pointer' : 'cursor-default')}
          tabIndex={-1}
        >
          <Steps.Indicator className={cn(stepBarClass, navigable && 'group-hover:bg-primary/25')} />
          <span className="text-[0.8rem] font-semibold text-fg-soft group-data-[complete]:text-fg group-data-[current]:text-fg">
            {name}
          </span>
        </Steps.Trigger>
      </Steps.Item>
    ))}
  </Steps.List>
)
