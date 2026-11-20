import { useConnect } from '@bootnodedev/canton-connect'
import { CalendarClock, ShieldCheck, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import gatewaySetPrimary from '@/assets/gateway-set-primary.png'
import walletPickerGateway from '@/assets/wallet-picker-gateway.png'
import { buttonClass } from '@/components/Button'
import { Card } from '@/components/Card'
import { ConnectFace } from '@/components/ConnectFace'
import { CopyButton } from '@/components/CopyButton'
import { LogoMark } from '@/icons'

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
    detail: 'In the wallet popup',
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
    detail: 'In the next step',
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
    detail: "It becomes the dApp's active party",
    key: 'primary',
    title: 'Set a party as primary',
  },
]

const facts = [
  { Icon: ShieldCheck, text: 'An escrow that holds real Amulet' },
  { Icon: CalendarClock, text: 'Linear or milestone schedules' },
  { Icon: Wallet, text: 'Every write approved in your wallet' },
]

export const ConnectPrompt = (): React.JSX.Element => (
  <section className="grid items-center gap-10 py-4 lg:min-h-[calc(100vh-17rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,28.75rem)] lg:gap-16">
    <div>
      <LogoMark width={56} height={56} />
      <h1 className="mt-7 max-w-[14ch] font-heading text-[2.5rem] leading-[1.05] font-extrabold text-fg sm:text-[3.25rem]">
        Vest Canton Coin on a schedule
      </h1>
      <p className="mt-4 max-w-[44ch] text-[1.0625rem] leading-relaxed text-fg-muted">
        Lock Amulet in escrow for a receiver and release it on a linear or milestone schedule. Every
        write goes through your wallet.
      </p>
      <ul className="mt-8 flex flex-col gap-3">
        {facts.map(({ Icon, text }) => (
          <li className="flex items-center gap-3 font-semibold text-fg" key={text}>
            <Icon className="shrink-0 text-primary-strong" size={20} />
            {text}
          </li>
        ))}
      </ul>
    </div>
    <Card className="p-2">
      <div className="px-4 pt-4 pb-2">
        <h2 className="font-heading text-base font-bold text-fg">Connect in four steps</h2>
        <p className="mt-0.5 text-sm text-fg-soft">Through the Wallet Gateway</p>
      </div>
      <ol className="divide-y divide-border">
        {steps.map(({ aside, detail, key, title }, index) => (
          <li className="flex min-h-16 items-center gap-3.5 px-4 py-3" key={key}>
            <span
              aria-hidden="true"
              className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-soft text-[0.8rem] font-bold text-primary-strong"
            >
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-fg">{title}</p>
              {detail !== undefined && <p className="text-[0.8rem] text-fg-soft">{detail}</p>}
            </div>
            {aside}
          </li>
        ))}
      </ol>
      <div className="px-2 pt-3 pb-2">
        <ConnectFace
          className={buttonClass('primary', 'lg', 'w-full')}
          cancelClassName={buttonClass('secondary', 'lg', 'w-full')}
        />
      </div>
    </Card>
  </section>
)
