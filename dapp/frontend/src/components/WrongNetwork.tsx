import { useParty } from '@/hooks/useParty'
import { useBackend } from '@/providers/Backend'
import { networkLabel } from '@/utils/network'

export const WrongNetwork = (): React.JSX.Element | null => {
  const { networkStatus } = useBackend()
  const { party } = useParty()

  return party === undefined || networkStatus === undefined || networkStatus === 'ok' ? null : (
    <div role="alert" className="border-b border-warning/35 bg-warning-soft px-5 py-2.5 sm:px-8">
      <p className="text-center text-xs text-fg">
        <span
          aria-hidden="true"
          className="mr-2 inline-block size-[5px] rounded-full bg-warning align-middle"
        />
        <strong className="font-bold">
          {networkStatus === 'unknown' ? <>Cannot determine network</> : <>Wrong network</>}:
        </strong>{' '}
        {networkStatus === 'unknown' ? (
          <>This might be temporary, try again in a few minutes.</>
        ) : (
          <>
            wallet is connected to{' '}
            <strong className="font-bold">{networkLabel(party.networkId)}</strong>, switch networks
            to proceed.
          </>
        )}
      </p>
    </div>
  )
}
