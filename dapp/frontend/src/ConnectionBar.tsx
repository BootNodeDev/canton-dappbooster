import { useConnect, useParty, useWalletStatus } from 'canton-connect-kit'
import type { JSX, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import {
  CHEVRON_DOWN_ICON,
  COPY_ICON,
  DISCONNECT_ICON,
  MOON_ICON,
  SUN_ICON,
} from '@/components/ui/icons'
import { Sheet } from '@/components/ui/Sheet'
import { toast } from '@/components/ui/toast'
import { useTheme } from '@/theme/useTheme'
import { copyToClipboard } from './utils/clipboard'
import { errorMessage } from './utils/errorMessage'
import { formatPartyId, shortenIdentifier } from './utils/formatPartyId'

const ICON_CHIP_CLASS =
  'inline-grid size-9 place-items-center rounded-full border border-border bg-surface ' +
  'text-muted-foreground transition-colors hover:text-primary hover:bg-primary-soft'

// Remember an extension connection so a reload can silently reconnect.
const RECONNECT_KEY = 'bn-canton-stampbook:reconnect'
const readReconnect = (): string | null => {
  try {
    return window.localStorage.getItem(RECONNECT_KEY)
  } catch {
    return null
  }
}
const writeReconnect = (value: string | null): void => {
  try {
    if (value === null) {
      window.localStorage.removeItem(RECONNECT_KEY)
    } else {
      window.localStorage.setItem(RECONNECT_KEY, value)
    }
  } catch {
    // ignore quota / privacy errors
  }
}

// App brand mark (stamp on the brand gradient); carpincho's logo marks the wallet.
const StarMark = ({ className }: { className: string }): JSX.Element => (
  <span
    className={`grid place-items-center bg-[image:var(--bg-gradient-brand)] text-white ${className}`}
  >
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-1/2">
      <path d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l7.1-1.01L12 2z" />
    </svg>
  </span>
)

// Wallet header (connect/account + theme), welcome hero, WC pairing, and lock
// gating; renders children only when connected + unlocked behind workspace-ready.
export const ConnectionBar = ({ children }: { children: ReactNode }): JSX.Element => {
  const { connect, disconnect, isConnecting, isConnected, pairingUri } = useConnect()
  const { party } = useParty()
  const { isLocked } = useWalletStatus()
  const { mode, setMode } = useTheme()

  const [pairingCopied, setPairingCopied] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [connectMenuOpen, setConnectMenuOpen] = useState(false)
  // Seeded before first paint so the reconnect check shows a spinner, not the hero.
  const [reconnecting, setReconnecting] = useState(() => readReconnect() === 'extension')
  const [connectMode, setConnectMode] = useState<'extension' | 'walletconnect' | undefined>(
    undefined,
  )

  const connectMenuRef = useRef<HTMLDivElement>(null)
  const accountMenuRef = useRef<HTMLDivElement>(null)
  // Set by a user-initiated connect; the success toast fires from the effect
  // below once `party` lands (connect() resolves before the context updates).
  const connectToastPending = useRef(false)
  // Guards the mount-only silent reconnect against StrictMode's double-invoke.
  const reconnectStarted = useRef(false)

  useEffect(() => {
    if (party !== undefined && connectToastPending.current) {
      connectToastPending.current = false
      toast.success(`Connected as ${formatPartyId(party.partyId)}`)
    }
  }, [party])

  // Close header menus on outside click / Escape (header backdrop-blur traps a
  // fixed backdrop, so use a document listener).
  useEffect(() => {
    if (!connectMenuOpen && !accountOpen) {
      return
    }
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as Node
      if (connectMenuRef.current !== null && !connectMenuRef.current.contains(target)) {
        setConnectMenuOpen(false)
      }
      if (accountMenuRef.current !== null && !accountMenuRef.current.contains(target)) {
        setAccountOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setConnectMenuOpen(false)
        setAccountOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [connectMenuOpen, accountOpen])

  // Toggle flips light/dark only; resolve `system` so the first click inverts.
  const resolvedTheme: 'light' | 'dark' =
    mode === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : mode

  const toggleTheme = (): void => {
    setMode(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  // Silently reconnect a prior extension session on reload (WC reconnects manually).
  // biome-ignore lint/correctness/useExhaustiveDependencies: run once on mount
  useEffect(() => {
    if (isConnected || readReconnect() !== 'extension') {
      setReconnecting(false)
      return
    }
    if (reconnectStarted.current) {
      return
    }
    reconnectStarted.current = true
    void connect('extension')
      // Wallet no longer authorized / not present — stay on the welcome screen.
      .catch(() => writeReconnect(null))
      .finally(() => setReconnecting(false))
  }, [])

  const onConnect = async (connectVia: 'extension' | 'walletconnect'): Promise<void> => {
    setConnectMode(connectVia)
    connectToastPending.current = true
    try {
      await connect(connectVia)
      writeReconnect(connectVia)
    } catch (err) {
      connectToastPending.current = false
      toast.error(errorMessage(err))
    } finally {
      setConnectMode(undefined)
    }
  }

  const onDisconnect = async (): Promise<void> => {
    setAccountOpen(false)
    setPairingCopied(false)
    // Drop any armed connect toast so a later party change can't fire a stale
    // "Connected as" after this disconnect.
    connectToastPending.current = false
    writeReconnect(null)
    await disconnect()
    toast.success('Disconnected.')
  }

  const copyPartyId = async (): Promise<void> => {
    if (party === undefined) {
      return
    }
    await copyToClipboard(party.partyId, 'Party id copied.')
  }

  const copyPairingUri = async (): Promise<void> => {
    if (pairingUri === undefined) {
      return
    }
    await copyToClipboard(pairingUri, () => {
      setPairingCopied(true)
      window.setTimeout(() => setPairingCopied(false), 1400)
    })
  }

  const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark'

  const themeToggle = (
    <button
      type="button"
      data-testid="theme-toggle"
      aria-label={`Switch to ${nextTheme} theme`}
      title={`Switch to ${nextTheme} theme`}
      onClick={toggleTheme}
      className={ICON_CHIP_CLASS}
    >
      {resolvedTheme === 'dark' ? MOON_ICON : SUN_ICON}
    </button>
  )

  const connectControls = !isConnected ? (
    <div className="relative" ref={connectMenuRef}>
      <button
        type="button"
        data-testid="connect-menu"
        onClick={() => setConnectMenuOpen((open) => !open)}
        aria-haspopup="true"
        aria-expanded={connectMenuOpen}
        disabled={isConnecting}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-border-strong bg-surface pl-4 pr-3 text-sm font-semibold text-foreground transition-colors enabled:hover:border-primary enabled:hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span>{isConnecting ? 'Connecting…' : 'Connect wallet'}</span>
        <span className="[&_svg]:size-4">{CHEVRON_DOWN_ICON}</span>
      </button>
      {connectMenuOpen && (
        <div className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-border bg-surface p-2 shadow-popover">
          <button
            type="button"
            data-testid="connect-extension"
            onClick={() => {
              setConnectMenuOpen(false)
              void onConnect('extension')
            }}
            disabled={isConnecting}
            className="flex w-full items-center gap-2.5 rounded-lg p-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            <img
              src="/carpincho-icon.svg"
              alt=""
              aria-hidden="true"
              className="size-6 rounded-full"
            />
            {isConnecting && connectMode === 'extension' ? 'Connecting…' : 'Carpincho Wallet'}
          </button>
          <button
            type="button"
            data-testid="connect-walletconnect"
            onClick={() => {
              setConnectMenuOpen(false)
              void onConnect('walletconnect')
            }}
            disabled={isConnecting}
            className="mt-1 flex w-full items-center gap-2.5 rounded-lg p-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            <img src="/walletconnect-logo.webp" alt="" aria-hidden="true" className="size-[18px]" />
            {isConnecting && connectMode === 'walletconnect' ? 'Pairing…' : 'WalletConnect'}
          </button>
        </div>
      )}
    </div>
  ) : (
    <div className="relative" ref={accountMenuRef}>
      <button
        type="button"
        data-testid="connected-party"
        data-party-id={party?.partyId ?? ''}
        onClick={() => setAccountOpen((open) => !open)}
        aria-haspopup="true"
        aria-expanded={accountOpen}
        className="inline-flex h-9 max-w-[220px] items-center gap-2 rounded-full border border-border bg-surface pl-1.5 pr-3 text-sm font-semibold text-foreground transition-colors hover:border-primary"
      >
        <span
          aria-hidden="true"
          className="size-6 shrink-0 rounded-full bg-[image:var(--bg-gradient-brand)]"
        />
        <span className="truncate">{(party?.partyId ?? '').split('::')[0]}</span>
        <span className="text-muted-foreground">{CHEVRON_DOWN_ICON}</span>
      </button>
      {accountOpen && (
        <div className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-border bg-surface p-3 shadow-popover">
          <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            Connected party
          </span>
          <div className="mt-1 flex items-stretch gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-muted p-2 font-mono text-xs text-foreground">
              {formatPartyId(party?.partyId ?? '')}
            </code>
            <button
              type="button"
              aria-label="Copy party id"
              title="Copy party id"
              onClick={() => {
                void copyPartyId()
              }}
              className="inline-grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-surface text-muted-foreground transition-colors hover:border-primary hover:text-primary [&_svg]:size-4"
            >
              {COPY_ICON}
            </button>
          </div>
          <button
            type="button"
            data-testid="logout"
            onClick={() => {
              void onDisconnect()
            }}
            className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-danger/40 bg-surface text-sm font-semibold text-danger transition-colors hover:bg-danger-soft [&_svg]:size-4"
          >
            {DISCONNECT_ICON}
            Disconnect
          </button>
        </div>
      )}
    </div>
  )

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-3 focus-visible:z-[70] focus-visible:rounded-md focus-visible:border focus-visible:border-border focus-visible:bg-surface focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-semibold focus-visible:text-foreground focus-visible:shadow-popover"
      >
        Skip to main content
      </a>
      <header className="sticky top-0 z-30 border-b border-border bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <StarMark className="size-8 rounded-lg" />
            <span className="font-display text-base font-extrabold tracking-[-0.01em] text-foreground">
              Stampbook
            </span>
          </div>
          <div className="flex items-center gap-2">
            {themeToggle}
            {reconnecting && !isConnected ? (
              <span
                role="status"
                aria-label="Checking wallet"
                className="inline-grid size-9 place-items-center"
              >
                <span className="size-4 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
              </span>
            ) : (
              connectControls
            )}
          </div>
        </div>
      </header>

      <Sheet
        open={
          !isConnected &&
          connectMode === 'walletconnect' &&
          (isConnecting || pairingUri !== undefined)
        }
        onOpenChange={(open) => {
          if (!open) {
            void disconnect()
          }
        }}
        side="center"
        title="WalletConnect"
        description="Pair a WalletConnect-compatible wallet."
      >
        {pairingUri === undefined ? (
          <div className="flex items-center gap-2.5 py-2 text-sm text-muted-foreground">
            <span className="size-4 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
            <span>Preparing WalletConnect…</span>
          </div>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted-foreground">
              Paste this pairing link into your WalletConnect-compatible wallet.
            </p>
            <code className="block break-all rounded-lg bg-muted p-3 font-mono text-xs text-foreground">
              {shortenIdentifier(pairingUri)}
            </code>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className={
                  pairingCopied
                    ? 'inline-flex h-9 items-center rounded-full border border-success/30 bg-success-soft px-4 text-sm font-semibold text-success'
                    : 'inline-flex h-9 items-center rounded-full border border-border-strong bg-surface px-4 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:text-primary'
                }
                onClick={() => {
                  void copyPairingUri()
                }}
              >
                {pairingCopied ? 'Copied' : 'Copy link'}
              </button>
            </div>
          </>
        )}
      </Sheet>

      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 outline-none sm:px-6"
      >
        {reconnecting && !isConnected ? (
          <section className="flex flex-col items-center gap-3 pt-20 text-center text-muted-foreground">
            <span
              role="status"
              aria-label="Checking wallet"
              className="size-8 animate-spin rounded-full border-2 border-primary/25 border-t-primary"
            />
            <p className="text-sm font-semibold">Checking your wallet…</p>
          </section>
        ) : !isConnected ? (
          <section className="flex flex-col items-center pt-10 pb-6 text-center sm:pt-20">
            <StarMark className="animate-drift mb-7 size-28 rounded-3xl" />
            <h1 className="max-w-xl font-display text-4xl font-extrabold leading-[1.05] tracking-[-0.02em] text-foreground sm:text-5xl">
              Loyalty stamp cards,
              <br />
              on-ledger
            </h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground">
              Stampbook demo: a merchant issues a stamp card, delegates stamping to staff, and
              cardholders watch their stamps add up toward a reward. Every stamp is a real Canton
              transaction.
            </p>
            <p className="mt-8 font-display text-lg font-bold text-foreground">
              Connect your wallet to begin
            </p>
            <button
              type="button"
              data-testid="hero-connect"
              onClick={() => {
                void onConnect('extension')
              }}
              disabled={isConnecting}
              className="relative isolate mt-4 inline-flex h-11 items-center gap-2 overflow-hidden rounded-full border border-primary bg-primary px-6 text-[0.95rem] font-semibold text-primary-foreground transition before:absolute before:inset-0 before:-z-10 before:bg-[image:var(--bg-gradient-brand)] before:opacity-0 before:transition-opacity enabled:hover:border-transparent enabled:hover:shadow-glow enabled:hover:before:opacity-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <img
                src="/carpincho-icon.svg"
                alt=""
                aria-hidden="true"
                className="size-6 rounded-full"
              />
              {isConnecting && connectMode === 'extension' ? 'Connecting…' : 'Carpincho Wallet'}
            </button>
            <p className="mt-1.5 text-xs text-muted-foreground">(browser extension)</p>

            <div className="mt-4 flex items-center gap-3 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <span className="h-px w-8 bg-border" />
              or
              <span className="h-px w-8 bg-border" />
            </div>

            <button
              type="button"
              data-testid="hero-connect-walletconnect"
              onClick={() => {
                void onConnect('walletconnect')
              }}
              disabled={isConnecting}
              className="mt-4 inline-flex h-11 items-center gap-2 rounded-full border border-border-strong bg-surface px-6 text-[0.95rem] font-semibold text-foreground transition-colors enabled:hover:border-primary enabled:hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              <img src="/walletconnect-logo.webp" alt="" aria-hidden="true" className="size-5" />
              {isConnecting && connectMode === 'walletconnect' ? 'Pairing…' : 'WalletConnect'}
            </button>
            <p className="mt-1.5 text-xs text-muted-foreground">(carpincho web app)</p>
          </section>
        ) : isLocked ? (
          <section
            className="mx-auto max-w-md rounded-2xl border border-border bg-surface p-5 shadow-card"
            data-testid="wallet-locked-banner"
          >
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
              Wallet locked
            </span>
            <h2 className="font-display text-lg font-semibold text-foreground">
              Unlock Carpincho to continue
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your wallet is locked. Open Carpincho and enter your password — this dApp will resume
              automatically.
            </p>
          </section>
        ) : party === undefined ? (
          <div className="mx-auto max-w-md rounded-2xl border border-border bg-surface p-5 text-muted-foreground shadow-card">
            <p className="m-0 font-semibold text-soft">
              Select an account in Carpincho to continue.
            </p>
          </div>
        ) : (
          <div data-testid="workspace-ready">{children}</div>
        )}
      </main>
    </div>
  )
}
