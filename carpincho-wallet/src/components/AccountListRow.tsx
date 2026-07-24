import { AccountRow } from '@/components/AccountRow'
import { CopyPartyIdButton } from '@/components/CopyPartyIdButton'
import { PLAIN_ICON_BUTTON_CLASS } from '@/components/ui/Button'
import { TRASH_ICON } from '@/components/ui/icons'
import { cn } from '@/utils/cn'
import type { AccountPublic } from '@/vault/types'

interface AccountListRowProps {
  account: AccountPublic
  canRemove: boolean
  onSelect: () => void
  onRequestRemove: () => void
}

// A full-row button selects the account; the copy and remove buttons sit above it so their clicks
// stay independent of selection. Remove is omitted when only one account exists.
export const AccountListRow = ({
  account,
  canRemove,
  onSelect,
  onRequestRemove,
}: AccountListRowProps): JSX.Element => (
  <div
    className={cn(
      'group/row relative flex w-full items-center gap-1 rounded-md border border-border bg-surface transition-colors',
      account.isPrimary && 'border-primary/60 bg-primary-soft/40',
    )}
  >
    <button
      type="button"
      data-testid="account-item"
      data-party-id={account.partyId}
      aria-current={account.isPrimary ? true : undefined}
      aria-label={account.name}
      onClick={onSelect}
      className="absolute inset-0 z-0 rounded-md outline-none transition-colors group-hover/row:bg-primary-soft focus-visible:shadow-focus"
    />
    <div className="pointer-events-none relative z-10 flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5">
      <AccountRow
        account={account}
        withName
        addressTrailing={<CopyPartyIdButton partyId={account.partyId} />}
      />
    </div>
    {canRemove && (
      <button
        type="button"
        data-testid="account-remove"
        onClick={onRequestRemove}
        aria-label={`Remove ${account.name}`}
        className={cn(PLAIN_ICON_BUTTON_CLASS, 'relative z-10 size-8 shrink-0 hover:text-danger')}
      >
        {TRASH_ICON}
      </button>
    )}
  </div>
)
