import { Steps } from '@ark-ui/react/steps'

const stepBarClass =
  'relative h-1 w-full rounded-[3px] bg-border ' +
  'before:absolute before:inset-0 before:origin-left before:scale-x-0 before:rounded-[3px] ' +
  'before:bg-primary before:transition-[scale,background-color] before:duration-500 ' +
  'before:ease-out before:content-[""] ' +
  'data-[complete]:before:scale-x-100 data-[complete]:before:bg-primary/45 ' +
  'data-[current]:before:scale-x-100'

export const StepBar = ({ steps }: { steps: string[] }): React.JSX.Element => (
  <Steps.List className="mb-6 flex gap-2">
    {steps.map((name, index) => (
      <Steps.Item className="group flex-1" index={index} key={name}>
        <Steps.Trigger
          className="flex w-full cursor-default flex-col items-start gap-2 rounded-[3px] pt-1.5 outline-none"
          tabIndex={-1}
        >
          <Steps.Indicator className={stepBarClass} />
          <span className="text-[0.8rem] font-semibold text-fg-soft group-data-[complete]:text-fg group-data-[current]:text-fg">
            {name}
          </span>
        </Steps.Trigger>
      </Steps.Item>
    ))}
  </Steps.List>
)
