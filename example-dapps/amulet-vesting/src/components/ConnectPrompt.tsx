import { useConnect } from '@bootnodedev/canton-connect'
import type { ReactNode } from 'react'
import gatewaySetPrimary from '@/assets/gateway-set-primary.png'
import walletPickerGateway from '@/assets/wallet-picker-gateway.png'
import { buttonClass } from '@/components/Button'
import { Card } from '@/components/Card'
import { ConnectFace } from '@/components/ConnectFace'
import { CopyButton } from '@/components/CopyButton'
import { EmptyState } from '@/components/EmptyState'

const cropClass = 'shrink-0 rounded-md border border-border'

const ConnectLink = (): React.JSX.Element => {
  const { connect, isPending } = useConnect()
  return (
    <button
      className="font-semibold text-primary-strong underline decoration-primary/40 underline-offset-3 transition-colors hover:decoration-primary disabled:opacity-60"
      disabled={isPending}
      onClick={() => void connect().catch(() => undefined)}
      type="button"
    >
      Connect wallet
    </button>
  )
}

interface Step {
  aside?: ReactNode
  detail?: string
  key: string
  title: ReactNode
}

const steps: Step[] = [
  {
    key: 'connect',
    title: (
      <>
        Click <ConnectLink />
      </>
    ),
  },
  {
    aside: (
      <img
        alt="Wallet Gateway in the wallet list"
        className={cropClass}
        height={46}
        src={walletPickerGateway}
        width={152}
      />
    ),
    detail: 'in the wallet popup',
    key: 'gateway',
    title: 'Choose Wallet Gateway',
  },
  {
    aside: (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.8rem] font-semibold text-fg">
        unsafe
        <CopyButton className="text-fg-muted" label="Client secret" size={12} value="unsafe" />
      </span>
    ),
    detail: 'in the next step',
    key: 'secret',
    title: 'Enter the client secret',
  },
  {
    aside: (
      <img
        alt="The Set as primary button in Wallet Gateway"
        className={cropClass}
        height={38}
        src={gatewaySetPrimary}
        width={102}
      />
    ),
    detail: "to set the dApp's active view",
    key: 'primary',
    title: 'Set a party as primary',
  },
]

export const ConnectPrompt = (): React.JSX.Element => (
  <EmptyState
    level={1}
    title="Canton Vesting"
    action={
      <ConnectFace
        className={buttonClass('primary', 'lg')}
        cancelClassName={buttonClass('secondary', 'lg')}
      />
    }
  >
    <Card className="mt-4 w-full overflow-hidden text-left">
      <ol className="divide-y divide-border">
        {steps.map(({ aside, detail, key, title }, index) => (
          <li className="flex min-h-14 items-center gap-3 px-4 py-3" key={key}>
            <span
              aria-hidden="true"
              className="grid size-6 shrink-0 place-items-center rounded-full bg-[image:var(--gradient-brand)] text-xs font-bold text-white"
            >
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-fg">{title}</p>
              {detail !== undefined && <p className="text-xs text-fg-muted">{detail}</p>}
            </div>
            {aside}
          </li>
        ))}
      </ol>
    </Card>
  </EmptyState>
)
