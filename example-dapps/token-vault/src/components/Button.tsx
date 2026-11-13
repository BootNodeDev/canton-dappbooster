import type { ButtonHTMLAttributes } from 'react'
import { Spinner } from '@/components/Spinner'
import { cn } from '@/utils/cn'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'sm' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  pending?: boolean
  size?: Size
  variant?: Variant
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-sm',
  lg: 'h-12 px-7 text-base',
}

const variants: Record<Variant, string> = {
  primary:
    'relative isolate overflow-hidden border border-primary bg-primary text-primary-fg ' +
    'before:absolute before:inset-0 before:-z-10 before:bg-[image:var(--gradient-brand)] ' +
    'before:opacity-0 before:transition-opacity not-disabled:hover:border-transparent ' +
    'not-disabled:hover:shadow-[var(--glow)] not-disabled:hover:before:opacity-100',
  secondary:
    'border border-border-strong bg-surface text-fg not-disabled:hover:border-primary not-disabled:hover:text-primary-strong',
  ghost:
    'border border-transparent text-fg-muted not-disabled:hover:bg-muted not-disabled:hover:text-fg',
}

export const buttonClass = (variant: Variant, size: Size, className?: string): string =>
  cn(
    'inline-flex items-center justify-center gap-2 rounded-[8px] font-semibold transition-colors',
    'focus-visible:outline-none focus-visible:shadow-[var(--ring)]',
    'disabled:cursor-not-allowed disabled:opacity-45',
    sizes[size],
    variants[variant],
    className,
  )

export const Button = ({
  variant = 'primary',
  size = 'sm',
  className,
  type = 'button',
  pending = false,
  disabled = false,
  children,
  'aria-label': ariaLabel,
  ...rest
}: ButtonProps): React.JSX.Element => (
  <button
    type={type}
    aria-busy={pending || undefined}
    // Dropped while pending: the visible label swaps to "Submitting…", and the live region says so
    aria-label={pending ? undefined : ariaLabel}
    className={buttonClass(variant, size, className)}
    disabled={disabled || pending}
    {...rest}
  >
    {pending ? (
      <>
        <Spinner size={16} />
        <span role="status">Submitting…</span>
      </>
    ) : (
      children
    )}
  </button>
)
