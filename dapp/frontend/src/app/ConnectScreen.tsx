import { shortenParty } from '@/lib/format'
import { useConnect, useParties } from '@/wallet/hooks'
import { ThemeToggle } from './ThemeToggle'

// Landing party picker. Picking a party enters the app. The party is remembered
// in localStorage so a reload lands back in the same session.

export const ConnectScreen = (): React.JSX.Element => {
  const { connect } = useConnect()
  const { pool, operator } = useParties()

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

        <p className="mt-9 text-lg font-bold text-fg">Choose a party to act as</p>

        <div className="mt-4 w-full max-w-md">
          {pool.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-sm text-fg-muted">
              No parties available. Run the vest-lite bootstrap to populate the pool.
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {pool.map((party) => (
                <li key={party.partyId}>
                  <button
                    type="button"
                    onClick={() => connect(party)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-left transition-colors hover:border-primary hover:shadow-[var(--glow)]"
                  >
                    <span className="flex items-center gap-3">
                      <span className="size-7 shrink-0 rounded-full bg-[image:var(--gradient-brand)]" />
                      <span className="font-semibold text-fg">{party.name}</span>
                    </span>
                    <span className="truncate font-mono text-xs text-fg-muted">
                      {shortenParty(party.partyId)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {operator !== '' && (
            <p className="mt-3 font-mono text-[0.7rem] text-fg-soft">
              factory owner · {shortenParty(operator)}
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
