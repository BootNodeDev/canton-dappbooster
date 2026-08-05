import { Identifier, useExplorerLink } from '@bootnodedev/canton-dappbooster'
import { copyToast } from '@/components/toast'
import { EXPLORER } from '@/lib/config'

interface CounterpartyIdProps {
  party: string
  /** The acting party receives from this counterparty, rather than sending to it. */
  incoming: boolean
}

/**
 * The other party on a grant or proposal: a from/to prefix and the id, copyable and linked to the
 * explorer. Renders inline, so it needs a block parent to carry the type styles.
 */
export const CounterpartyId = ({ party, incoming }: CounterpartyIdProps): React.JSX.Element => {
  const explorerLink = useExplorerLink(EXPLORER)

  return (
    <>
      {incoming ? 'from' : 'to'}{' '}
      <Identifier
        // The Toaster is the app's live region, so the kit's own would announce a second time.
        announce={false}
        className="text-fg-soft"
        href={explorerLink(party)}
        label={incoming ? 'sender party id' : 'recipient party id'}
        onCopy={copyToast('Party id')}
        value={party}
      />
    </>
  )
}
