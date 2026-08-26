import { Select } from '@/components/Select'
import type { Role } from '@/store/types'

const roles: { value: Role; label: string }[] = [
  { value: 'receiver', label: 'Receiver' },
  { value: 'funder', label: 'Funder' },
]

// The connected party is fixed; this lens chooses whether to view grants where
// the party is receiver or creator.
export const RoleSelect = ({
  value,
  onChange,
}: {
  value: Role
  onChange: (role: Role) => void
}): React.JSX.Element => (
  <Select label="View as" value={value} options={roles} onChange={onChange} />
)
