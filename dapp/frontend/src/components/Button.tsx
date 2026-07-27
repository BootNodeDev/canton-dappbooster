import type { ButtonHTMLAttributes } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

interface BaseProps {
  variant?: Variant
  size?: Size
  className?: string
}

interface ButtonAsButton extends BaseProps, ButtonHTMLAttributes<HTMLButtonElement> {
  asLink?: false
}

interface ButtonAsLink extends BaseProps {
  asLink: true
  to: string
  children?: React.ReactNode
}

type ButtonProps = ButtonAsButton | ButtonAsLink

const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-6 text-[0.95rem]',
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
  danger: 'border border-danger/40 bg-surface text-danger enabled:hover:bg-danger-soft',
}

const classesFor = (variant: Variant, size: Size, className?: string): string =>
  cn(
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors',
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
      <Link to={to} className={classesFor(variant, size, className)}>
        {children}
      </Link>
    )
  }
  const {
    variant = 'primary',
    size = 'md',
    className,
    type = 'button',
    asLink: _a,
    ...rest
  } = props
  return <button type={type} className={classesFor(variant, size, className)} {...rest} />
}
