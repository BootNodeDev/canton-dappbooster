import type { ReactNode } from 'react'
import { AccountAvatar } from '@/components/ui/AccountAvatar'
import { shortMiddle } from '@/utils/account'
import { cn } from '@/utils/cn'
import type { AccountPublic } from '@/vault/types'

interface AccountRowProps {
  account: AccountPublic
  withName?: boolean
  addressTrailing?: ReactNode
  avatarSize?: 'sm' | 'md'
}

// Shared account identity (avatar + party id). With `withName`, the name becomes the primary label
// and the party id drops to a secondary line; `addressTrailing` adds a slot beside the address.
export const AccountRow = ({
  account,
  withName = false,
  addressTrailing,
  avatarSize = 'md',
}: AccountRowProps): JSX.Element => (
  <div className="flex min-w-0 flex-1 items-center gap-2">
    <AccountAvatar
      partyId={account.partyId}
      size={avatarSize}
    />
    <div className="min-w-0 flex-1">
      {withName && (
        <span className="block truncate text-[0.9rem] font-semibold text-foreground">
          {account.name}
        </span>
      )}
      <div className="flex min-w-0 items-center gap-1.5">
        <span
          title={withName ? account.partyId : account.name}
          className={cn(
            'min-w-0 truncate font-mono text-foreground',
            withName
              ? 'text-[0.75rem] font-medium text-muted-foreground'
              : 'text-[0.9rem] font-semibold',
          )}
        >
          {shortMiddle(account.partyId, 12, 7)}
        </span>
        {addressTrailing}
      </div>
    </div>
  </div>
)
