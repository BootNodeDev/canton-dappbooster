import { CalendarClock, ShieldCheck, UserRound } from 'lucide-react'
import { AuthCard } from '@/components/AuthCard'
import { LogoMark } from '@/icons'

const facts = [
  { Icon: UserRound, text: 'Every account comes with its own party' },
  { Icon: CalendarClock, text: 'Linear or milestone schedules' },
  { Icon: ShieldCheck, text: 'Funds held in escrow on the ledger' },
]

export const SignInPrompt = (): React.JSX.Element => (
  <section className="grid items-center gap-10 py-4 lg:min-h-[calc(100vh-17rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,28.75rem)] lg:gap-16">
    <div>
      <LogoMark width={56} height={56} />
      <h1 className="mt-7 max-w-[14ch] font-heading text-[2.5rem] leading-[1.05] font-extrabold text-fg sm:text-[3.25rem]">
        Vest Canton Coin without a wallet
      </h1>
      <p className="mt-4 max-w-[44ch] text-[1.0625rem] leading-relaxed text-fg-muted">
        Sign in to see your grants, or create an account to get a Canton party of your own. The app
        signs for your party, so there is nothing to install.
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
    <AuthCard />
  </section>
)
