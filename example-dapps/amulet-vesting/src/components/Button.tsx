import type { ButtonHTMLAttributes } from 'react'
import { Link } from 'react-router-dom'
import { Spinner } from '@/components/Spinner'
import { cn } from '@/utils/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost'
type Size = 'sm' | 'md' | 'lg' | 'icon'

interface BaseProps {
  'aria-label'?: string
  className?: string
  size?: Size
  variant?: Variant
}

interface ButtonAsButton extends BaseProps, ButtonHTMLAttributes<HTMLButtonElement> {
  asLink?: false
  pending?: boolean
}

interface ButtonAsLink extends BaseProps {
  asLink: true
  children?: React.ReactNode
  to: string
}

type ButtonProps = ButtonAsButton | ButtonAsLink

const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-6 text-[0.95rem]',
  lg: 'h-12 px-7 text-base',
  icon: 'size-8',
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
  danger: 'border border-danger bg-danger text-white not-disabled:hover:bg-danger/90',
  'danger-ghost': 'border border-transparent text-danger not-disabled:hover:bg-danger-soft',
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

export const Button = (props: ButtonProps): React.JSX.Element => {
  if (props.asLink === true) {
    const { variant = 'primary', size = 'md', className, to, children } = props
    return (
      <Link
        to={to}
        aria-label={props['aria-label']}
        className={buttonClass(variant, size, className)}
      >
        {children}
      </Link>
    )
  }
  const {
    variant = 'primary',
    size = 'md',
    className,
    type = 'button',
    pending = false,
    disabled = false,
    children,
    asLink: _a,
    ...rest
  } = props
  return (
    <button
      type={type}
      aria-busy={pending || undefined}
      className={buttonClass(variant, size, className)}
      disabled={disabled || pending}
      {...rest}
    >
      {pending ? (
        <>
          <Spinner size={16} />
          Submitting…
        </>
      ) : (
        children
      )}
    </button>
  )
}
