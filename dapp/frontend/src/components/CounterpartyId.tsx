import { Identifier } from '@bootnodedev/canton-dappbooster'
import { copyToast } from '@/components/toast'

interface CounterpartyIdProps {
  party: string
  /** The acting party receives from this counterparty, rather than sending to it. */
  incoming: boolean
  /** Explorer URL. Optional, and per call site: not every card links its counterparty. */
  href?: string
}

/**
 * The other party on a grant or proposal: a from/to prefix and the id, copyable. Renders inline, so
 * it needs a block parent to carry the type styles.
 */
export const CounterpartyId = ({
  party,
  incoming,
  href,
}: CounterpartyIdProps): React.JSX.Element => {
  return (
    <>
      {incoming ? 'from' : 'to'}{' '}
      <Identifier
        // The Toaster is the app's live region, so the kit's own would announce a second time.
        announce={false}
        className="text-fg-soft"
        href={href}
        label={incoming ? 'sender party id' : 'recipient party id'}
        onCopy={copyToast('Party id')}
        value={party}
      />
    </>
  )
}
