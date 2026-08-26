import type { ButtonHTMLAttributes } from 'react'
import { Link } from 'react-router-dom'
import { SpinnerIcon } from '@/icons'
import { cn } from '@/utils/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost'
type Size = 'sm' | 'md' | 'lg' | 'icon'

// `aria-label` is declared here rather than left to the DOM props because the link form takes no
// DOM props, and an icon-only button has no text to read.
interface BaseProps {
  'aria-label'?: string
  className?: string
  size?: Size
  variant?: Variant
}

// `pending` owns the whole in-flight look, because every dialog that had it hand-rolled drifted:
// two rendered a spinner beside the word and the third rendered the word alone.
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
  icon: 'size-9',
}

// Primary carries the Aurora accent: brand gradient + glow on hover.
const variants: Record<Variant, string> = {
  primary:
    'relative isolate overflow-hidden border border-primary bg-primary text-primary-fg ' +
    'before:absolute before:inset-0 before:-z-10 before:bg-[image:var(--gradient-brand)] ' +
    'before:opacity-0 before:transition-opacity enabled:hover:border-transparent ' +
    'enabled:hover:shadow-[var(--glow)] enabled:hover:before:opacity-100',
  secondary:
    'border border-border-strong bg-surface text-fg enabled:hover:border-primary enabled:hover:text-primary',
  ghost: 'border border-transparent text-fg-muted enabled:hover:bg-muted enabled:hover:text-fg',
  danger: 'border border-danger bg-danger text-white enabled:hover:bg-danger/90',
  'danger-ghost': 'border border-transparent text-danger enabled:hover:bg-danger-soft',
}

// Exported for the kit's own buttons, which cannot render this component but can take its classes.
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
      className={buttonClass(variant, size, className)}
      disabled={disabled || pending}
      {...rest}
    >
      {pending ? (
        <>
          <SpinnerIcon width={16} height={16} />
          Submitting…
        </>
      ) : (
        children
      )}
    </button>
  )
}
