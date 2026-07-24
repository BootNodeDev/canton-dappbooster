import { scorePassword } from '@/vault/passwordStrength'

type Tier = { segmentColor: string; labelColor: string; label: string }

const TOO_WEAK: Tier = { segmentColor: 'bg-danger', labelColor: 'text-danger', label: 'Too weak' }
const FAIR: Tier = { segmentColor: 'bg-warning', labelColor: 'text-warning', label: 'Fair' }
const STRONG: Tier = { segmentColor: 'bg-success', labelColor: 'text-success', label: 'Strong' }
const EXCELLENT: Tier = {
  segmentColor: 'bg-primary',
  labelColor: 'text-primary',
  label: 'Excellent',
}

const TIERS: readonly Tier[] = [TOO_WEAK, TOO_WEAK, FAIR, STRONG, EXCELLENT]

type Props = {
  password: string
  id?: string
}

export const PasswordStrengthIndicator = ({ password, id }: Props): JSX.Element => {
  const score = scorePassword(password)
  const tier = TIERS[Math.min(Math.max(score, 0), 4)] ?? TOO_WEAK
  const empty = password.length === 0

  return (
    <div
      className="flex flex-col gap-2"
      id={id}
    >
      <div className="relative pt-5">
        <span
          aria-live="polite"
          className={`absolute top-0 right-0 text-[0.75rem] font-mono ${empty ? 'invisible' : tier.labelColor}`}
        >
          {empty ? '' : tier.label}
        </span>
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((seg) => (
            <div
              key={seg}
              className={`h-1.5 flex-1 rounded-full transition-colors ${score >= seg ? tier.segmentColor : 'bg-muted'}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
