import { Select } from '@/components/Select'
import type { Role } from '@/store/types'

const roles: { label: string; value: Role }[] = [
  { value: 'receiver', label: 'Receiver' },
  { value: 'funder', label: 'Funder' },
]

// The connected party is fixed; this lens chooses whether to view grants where
// the party is receiver or creator.
export const RoleSelect = ({
  value,
  onChange,
}: {
  onChange: (role: Role) => void
  value: Role
}): React.JSX.Element => (
  <Select label="View as" value={value} options={roles} onChange={onChange} />
)
