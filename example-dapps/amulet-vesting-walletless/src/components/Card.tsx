import type { HTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

type Tone = 'hero' | 'plain'

const tones: Record<Tone, string> = {
  hero: 'bg-[image:var(--hero-bg)] text-[var(--hero-fg)] [--card-border:var(--hero-border)] [--card-shadow:var(--hero-shadow)]',
  plain: '',
}

// Border and shadow read variables, so a caller sets `--card-edge` instead of racing these classes.
export const Card = ({
  className,
  tone = 'plain',
  ...rest
}: HTMLAttributes<HTMLDivElement> & { tone?: Tone }): React.JSX.Element => (
  <div
    className={cn(
      'rounded-card border border-[var(--card-border,var(--border))] bg-surface shadow-[var(--card-edge,0_0_#0000),var(--card-shadow,var(--shadow-card))]',
      tones[tone],
      className,
    )}
    {...rest}
  />
)
