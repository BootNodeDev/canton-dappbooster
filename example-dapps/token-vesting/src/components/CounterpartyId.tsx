import { Identifier } from '@bootnodedev/canton-dappbooster'

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
        className="text-fg-soft"
        label={incoming ? 'sender party id' : 'recipient party id'}
        value={party}
      />
    </>
  )
}
