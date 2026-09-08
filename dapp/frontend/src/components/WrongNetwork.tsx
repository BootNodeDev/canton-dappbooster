import { truncateIdentifier } from '@bootnodedev/canton-dappbooster'
import { useBackend } from '@/providers/Backend'

// A shade under the sentence's `text-xs`, because the mono face reads larger at the same size.
const idClass = 'font-mono text-[0.72rem] font-bold'

// Above the header rather than on a page: the mismatch outlives any route, and every write fails
// while it stands. Nothing dismisses it, because only the wallet can put it right.
export const WrongNetwork = (): React.JSX.Element | null => {
  const { wrongNetwork } = useBackend()

  if (wrongNetwork === undefined) {
    return null
  }

  return (
    <div role="alert" className="border-b border-warning/35 bg-warning-soft px-5 py-2.5 sm:px-8">
      <p className="text-center text-xs text-fg">
        <span
          aria-hidden="true"
          className="mr-2 inline-block size-[5px] rounded-full bg-warning align-middle"
        />
        Wrong network. Currently on{' '}
        <span className={idClass}>{truncateIdentifier(wrongNetwork.wallet)}</span>, switch to{' '}
        <span className={idClass}>{truncateIdentifier(wrongNetwork.app)}</span>.
      </p>
    </div>
  )
}
