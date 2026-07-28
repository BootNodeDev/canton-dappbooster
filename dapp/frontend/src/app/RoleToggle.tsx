import { cn } from '@/lib/cn'
import type { Role } from '@/store/types'
import { useUiStore } from '@/store/useUiStore'

const roles: { value: Role; label: string }[] = [
  { value: 'receiver', label: 'Receiver' },
  { value: 'funder', label: 'Funder' },
]

// The connected party is fixed; this lens chooses whether to view grants where
// the party is receiver or creator.
export const RoleToggle = (): React.JSX.Element => {
  const role = useUiStore((s) => s.role)
  const setRole = useUiStore((s) => s.setRole)
  return (
    <div className="inline-flex rounded-full border border-border bg-surface-2 p-1">
      {roles.map((r) => (
        <button
          key={r.value}
          type="button"
          onClick={() => setRole(r.value)}
          className={cn(
            'rounded-full px-4 py-1.5 text-[0.8rem] font-bold transition-colors',
            role === r.value
              ? 'bg-[image:var(--gradient-brand)] text-white shadow-[var(--glow)]'
              : 'text-fg-muted hover:text-fg',
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}
