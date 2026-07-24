import { AccountRow } from '@/components/AccountRow'
import type { AccountPublic } from '@/vault/types'

export interface ContactsPickerProps {
  contacts: AccountPublic[]
  onSelect: (partyId: string) => void
}

// Fixed height of exactly 4 rows (4 × h-14 + 3 × gap-1) so the list never resizes the
// sheet and a longer list scrolls.
const LIST_CLASS = 'flex h-[236px] flex-col gap-1 overflow-y-auto'

export const ContactsPicker = ({ contacts, onSelect }: ContactsPickerProps): JSX.Element => {
  if (contacts.length === 0) {
    return (
      <p className="px-2 py-6 text-center text-[0.92rem] text-muted-foreground">
        No other accounts to send to. Add another account to build your contacts.
      </p>
    )
  }
  return (
    <div className={LIST_CLASS}>
      {contacts.map((account) => (
        <button
          key={account.id}
          type="button"
          data-testid="contact-row"
          data-party-id={account.partyId}
          aria-label={account.name}
          onClick={() => onSelect(account.partyId)}
          className="flex h-14 shrink-0 items-center rounded-sm px-2 text-left outline-none transition-colors hover:bg-primary-soft focus-visible:shadow-focus"
        >
          <AccountRow
            account={account}
            withName
          />
        </button>
      ))}
    </div>
  )
}
