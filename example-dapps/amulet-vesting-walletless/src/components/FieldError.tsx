import { cn } from '@/utils/cn'

interface FieldErrorProps {
  className?: string
  id: string
  message: string
}

export const FieldError = ({ id, message, className }: FieldErrorProps): React.JSX.Element => (
  <p id={id} role="alert" className={cn('text-xs text-danger', className)}>
    {message}
  </p>
)
