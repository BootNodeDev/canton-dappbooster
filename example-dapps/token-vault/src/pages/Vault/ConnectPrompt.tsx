import { Landmark, MonitorSmartphone, ShieldCheck, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import { buttonClass } from '@/components/Button'
import { Card } from '@/components/Card'
import { ConnectFace } from '@/components/ConnectFace'
import { CopyButton } from '@/components/CopyButton'
import { LogoMark } from '@/icons'
import { cn } from '@/utils/cn'

const chipClass =
  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 text-[0.8rem] font-semibold text-fg'

interface Step {
  aside?: ReactNode
  detail: string
  title: string
}

const steps: Step[] = [
  { detail: 'Below, or in the top bar', title: 'Click Connect wallet' },
  {
    aside: (
      <span className={chipClass}>
        <MonitorSmartphone size={15} />
        Wallet Gateway
      </span>
    ),
    detail: 'In the wallet popup',
    title: 'Choose Wallet Gateway',
  },
  {
    aside: (
      <span className={cn(chipClass, 'font-mono')}>
        unsafe
        <CopyButton className="text-fg-muted" label="Client secret" size={12} value="unsafe" />
      </span>
    ),
    detail: 'In the next step',
    title: 'Enter the client secret',
  },
  {
    aside: <span className={cn(chipClass, 'text-primary-strong')}>Set as primary</span>,
    detail: "It becomes the dApp's active party",
    title: 'Set a party as primary',
  },
]

const facts = [
  { Icon: ShieldCheck, text: 'Every share backed by USDX in the vault' },
  { Icon: Landmark, text: 'Each request settles on the ledger' },
  { Icon: Wallet, text: 'Every write approved in your wallet' },
]

export const ConnectPrompt = (): React.JSX.Element => (
  <section className="grid items-center gap-10 py-4 lg:min-h-[calc(100vh-17rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,28.75rem)] lg:gap-16">
    <div>
      <LogoMark width={56} height={56} />
      <h1 className="mt-7 max-w-[14ch] font-heading text-[2.5rem] leading-[1.05] font-extrabold text-fg sm:text-[3.25rem]">
        Hold USDX as vault shares
      </h1>
      <p className="mt-4 max-w-[44ch] text-[1.0625rem] leading-relaxed text-fg-muted">
        Deposit USDX to mint VSH one for one, and withdraw shares for USDX. The vault accepts each
        request, and your wallet funds it.
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
        {steps.map(({ aside, detail, title }, index) => (
          <li className="flex min-h-16 items-center gap-3.5 px-4 py-3" key={title}>
            <span
              aria-hidden="true"
              className="grid size-7 shrink-0 place-items-center rounded-md bg-fg text-[0.8rem] font-bold text-bg"
            >
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-fg">{title}</p>
              <p className="text-[0.8rem] text-fg-soft">{detail}</p>
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
