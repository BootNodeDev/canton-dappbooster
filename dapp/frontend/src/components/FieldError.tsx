import { cn } from '@/utils/cn'

interface FieldErrorProps {
  className?: string
  // Referenced by the field's `aria-describedby`, so the two have to agree.
  id: string
  message: string
}

// One place for the error handshake every field repeats: the id the field points at, and the live
// region that announces a message appearing rather than waiting for the field to be focused.
export const FieldError = ({ id, message, className }: FieldErrorProps): React.JSX.Element => (
  <p id={id} role="alert" className={cn('text-xs text-danger', className)}>
    {message}
  </p>
)
