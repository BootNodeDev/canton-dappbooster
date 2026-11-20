import { Pills } from '@/components/Pills'
import type { Role } from '@/store/types'

const roles = [
  { value: 'receiver', label: 'Received' },
  { value: 'funder', label: 'Created' },
] as const satisfies readonly { label: string; value: Role }[]

export const RoleSelect = ({
  value,
  onChange,
}: {
  onChange: (role: Role) => void
  value: Role
}): React.JSX.Element => (
  <div className="flex items-center gap-2.5 text-sm font-semibold text-fg-muted">
    <span aria-hidden="true" className="max-sm:hidden">
      View as
    </span>
    <Pills label="View as" onChange={onChange} options={roles} value={value} variant="segmented" />
  </div>
)
