import { useDismissable } from '@/hooks/useDismissable'
import { CaretDownIcon } from '@/icons'
import type { Role } from '@/store/types'
import { cn } from '@/utils/cn'

const roles: { label: string; value: Role }[] = [
  { value: 'receiver', label: 'Received' },
  { value: 'funder', label: 'Created' },
]

// The connected party is fixed; this lens chooses whether to view grants where the party is
// receiver or creator. Not a `<select>`: the trigger has to read as part of the page title, and the
// browser renders that size into its own option list, which no CSS on `<option>` can take back.
export const RoleSelect = ({
  value,
  onChange,
}: {
  onChange: (role: Role) => void
  value: Role
}): React.JSX.Element => {
  // On every button rather than on the wrapper, because focus leaving the whole control is what
  // closes it and a handler on a plain span is neither reachable nor allowed.
  const { closers, keepFocus, open, root, setOpen, trigger } = useDismissable<HTMLSpanElement>()
  const current = roles.find((role) => role.value === value) ?? roles[0]

  return (
    <span className="relative inline-flex" ref={root}>
      <button
        {...closers}
        type="button"
        aria-expanded={open}
        aria-label={`View as: ${current.label}`}
        onClick={() => setOpen(!open)}
        ref={trigger}
        className="inline-flex items-center gap-1.5 text-xl font-extrabold tracking-tight text-fg-muted transition-colors hover:text-fg"
      >
        {current.label}
        <CaretDownIcon width={16} height={16} />
      </button>
      {open && (
        <span className="absolute left-0 top-full z-30 mt-1 flex min-w-max flex-col gap-0.5 rounded-lg border border-border bg-surface p-1 shadow-[var(--shadow-popover)]">
          {roles.map((role) => (
            <button
              {...closers}
              key={role.value}
              type="button"
              aria-pressed={role.value === value}
              onMouseDown={keepFocus}
              onClick={() => {
                onChange(role.value)
                setOpen(false)
              }}
              className={cn(
                'rounded-md px-3 py-1.5 text-left text-sm font-semibold transition-colors',
                role.value === value ? 'bg-primary-soft text-fg' : 'text-fg-muted hover:text-fg',
              )}
            >
              {role.label}
            </button>
          ))}
        </span>
      )}
    </span>
  )
}
