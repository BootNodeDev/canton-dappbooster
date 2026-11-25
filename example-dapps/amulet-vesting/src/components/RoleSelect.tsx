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
  <Pills label="View as" onChange={onChange} options={roles} value={value} variant="segmented" />
)
