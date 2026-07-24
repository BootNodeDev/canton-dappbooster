import { Copyable } from '@/components/ui/Copyable'

interface CopyPartyIdButtonProps {
  partyId: string
}

// Address-row copy button; delegates to the shared Copyable while keeping its test id.
export const CopyPartyIdButton = ({ partyId }: CopyPartyIdButtonProps): JSX.Element => (
  <Copyable
    value={partyId}
    label="party ID"
    successMessage="Party ID copied"
    testId="account-copy-party-id"
  />
)
