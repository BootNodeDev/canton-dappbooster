import { Identifier } from '@bootnodedev/canton-dappbooster'

interface CounterpartyIdProps {
  incoming: boolean
  party: string
}

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
