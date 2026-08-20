import { ConnectButton } from '@bootnodedev/canton-dappbooster/connect'
import { useConnectLabel } from '@/hooks/useConnectLabel'
import { ThemeToggle } from './ThemeToggle'

// Landing screen. The shell swaps to the app once a session exists, so a connected visitor never
// reaches this screen and the button only ever needs its connect face.

export const ConnectScreen = (): React.JSX.Element => {
  const label = useConnectLabel()

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <span className="size-8 rounded-xl bg-[image:var(--gradient-brand)] shadow-[var(--glow)]" />
          <span className="text-base font-extrabold tracking-tight text-fg">Canton Vesting</span>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-24 text-center">
        <span className="mb-8 size-24 rounded-[1.75rem] bg-[image:var(--gradient-brand)] shadow-[var(--glow)]" />
        <h1 className="max-w-xl text-4xl font-extrabold leading-[1.05] tracking-tight text-fg sm:text-5xl">
          Vesting for Canton Coin
        </h1>
        <p className="mt-4 max-w-lg text-base leading-relaxed text-fg-muted">
          Track grants vesting to you, claim what has unlocked, and create grants for others. Every
          claim is a real Canton transaction; the factory is delivered via explicit disclosure.
        </p>
        <ConnectButton className="mt-9" mode="connect">
          {label}
        </ConnectButton>
      </main>
    </div>
  )
}
