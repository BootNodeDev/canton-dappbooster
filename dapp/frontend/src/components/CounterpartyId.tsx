import { Identifier } from '@bootnodedev/canton-dappbooster'
import { copyToast } from '@/utils/toast'

interface CounterpartyIdProps {
  incoming: boolean
  party: string
}

// The other party on a grant or pending grant: a from/to prefix and the id, copyable. Renders inline, so
// it needs a block parent to carry the type styles.
export const CounterpartyId = ({ party, incoming }: CounterpartyIdProps): React.JSX.Element => {
  return (
    <>
      {incoming ? 'from' : 'to'}{' '}
      <Identifier
        // The Toaster is the app's live region, so the kit's own would announce a second time.
        announce={false}
        className="text-fg-soft"
        label={incoming ? 'sender party id' : 'recipient party id'}
        onCopy={copyToast('Party id')}
        value={party}
      />
    </>
  )
}
