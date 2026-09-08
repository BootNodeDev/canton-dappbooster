import { useParty } from '@/hooks/useParty'
import { useBackend } from '@/providers/Backend'
import { networkLabel } from '@/utils/network'

// Above the header rather than on a page: the mismatch outlives any route, and every write fails
// while it stands. Nothing dismisses it, because only the wallet can put it right.
export const WrongNetwork = (): React.JSX.Element | null => {
  const { wrongNetwork } = useBackend()
  const { party } = useParty()

  if (!wrongNetwork || party === undefined) {
    return null
  }

  return (
    <div role="alert" className="border-b border-warning/35 bg-warning-soft px-5 py-2.5 sm:px-8">
      <p className="text-center text-xs text-fg">
        <span
          aria-hidden="true"
          className="mr-2 inline-block size-[5px] rounded-full bg-warning align-middle"
        />
        <strong className="font-bold">Wrong network:</strong> wallet is connected to{' '}
        <strong className="font-bold">{networkLabel(party.networkId)}</strong>, switch networks to
        proceed.
      </p>
    </div>
  )
}
