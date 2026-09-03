import { Menu } from '@ark-ui/react/menu'
import { Portal } from '@ark-ui/react/portal'
import { ChevronDown } from 'lucide-react'
import type { Role } from '@/store/types'
import { cn } from '@/utils/cn'
import { popoverClass, popoverItemClass } from '@/utils/popover'

const roles: { label: string; value: Role }[] = [
  { value: 'receiver', label: 'Received' },
  { value: 'funder', label: 'Created' },
]

// The connected party is fixed; this lens chooses whether to view grants where the party is
// receiver or creator. A menu rather than `components/Select`, because it commands the view rather
// than holding a value, and its trigger has to read as part of the page title.
export const RoleSelect = ({
  value,
  onChange,
}: {
  onChange: (role: Role) => void
  value: Role
}): React.JSX.Element => {
  const current = roles.find((role) => role.value === value) ?? roles[0]

  return (
    <Menu.Root positioning={{ placement: 'bottom-start' }}>
      <Menu.Trigger
        aria-label={`View as: ${current.label}`}
        className="inline-flex items-center gap-1.5 text-xl font-extrabold tracking-tight text-fg-muted transition-colors hover:text-fg"
      >
        {current.label}
        <ChevronDown size={16} />
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content
            className={cn(popoverClass, 'flex min-w-max flex-col gap-0.5 rounded-lg p-1')}
          >
            <Menu.RadioItemGroup
              onValueChange={(details) => onChange(details.value as Role)}
              value={value}
            >
              {roles.map((role) => (
                <Menu.RadioItem
                  className={cn(popoverItemClass, 'text-sm')}
                  key={role.value}
                  value={role.value}
                >
                  <Menu.ItemText>{role.label}</Menu.ItemText>
                </Menu.RadioItem>
              ))}
            </Menu.RadioItemGroup>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  )
}
