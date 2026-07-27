import { useEffect, useRef, useState } from 'react'
import { ChevronDownIcon, CopyIcon, LogoutIcon } from '@/components/icons'
import { toast } from '@/components/toast'
import { partyHint, shortenParty } from '@/lib/format'
import { useConnect, useParties, useParty } from '@/wallet/hooks'

// Party switcher. Pill shows the acting party hint + chevron. The menu lets you
// copy the acting id, switch to another party in the pool, see the operator as the
// (non-selectable) factory owner, and sign out back to the picker.
export const WalletControl = (): React.JSX.Element | null => {
  const { connect, disconnect } = useConnect()
  const { party } = useParty()
  const { pool, operator } = useParties()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    const onDown = (e: PointerEvent): void => {
      if (ref.current !== null && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  if (party === undefined) {
    return null
  }

  const copyId = async (id: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(id)
      toast.success('Party id copied')
    } catch {
      toast.error('Could not copy')
    }
  }

  const others = pool.filter((candidate) => candidate.partyId !== party.partyId)

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        className="inline-flex h-9 max-w-[220px] items-center gap-2 rounded-full border border-border bg-surface pl-1.5 pr-3 text-sm font-semibold text-fg transition-colors hover:border-primary"
      >
        <span className="size-6 shrink-0 rounded-full bg-[image:var(--gradient-brand)]" />
        <span className="truncate font-mono text-xs">{partyHint(party.partyId)}</span>
        <ChevronDownIcon width={15} height={15} className="text-fg-muted" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-border bg-surface p-3 shadow-[var(--shadow-popover)]">
          <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-fg-muted">
            Acting as
          </span>
          <div className="mt-1 flex items-stretch gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-muted p-2 font-mono text-xs text-fg">
              {shortenParty(party.partyId)}
            </code>
            <button
              type="button"
              aria-label="Copy party id"
              onClick={() => void copyId(party.partyId)}
              className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-surface text-fg-muted transition-colors hover:border-primary hover:text-primary"
            >
              <CopyIcon width={15} height={15} />
            </button>
          </div>

          {others.length > 0 && (
            <div className="mt-3">
              <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-fg-muted">
                Switch party
              </span>
              <ul className="mt-1.5 flex max-h-56 flex-col gap-1 overflow-y-auto">
                {others.map((candidate) => (
                  <li key={candidate.partyId} className="flex items-stretch gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        connect(candidate)
                        setOpen(false)
                        toast.success(`Acting as ${candidate.name}`)
                      }}
                      className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg p-2 text-sm font-semibold text-fg transition-colors hover:bg-muted"
                    >
                      <span className="flex items-center gap-2">
                        <span className="size-5 shrink-0 rounded-full bg-[image:var(--gradient-brand)]" />
                        {candidate.name}
                      </span>
                      <span className="truncate font-mono text-[0.7rem] text-fg-muted">
                        {shortenParty(candidate.partyId)}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Copy ${candidate.name} party id`}
                      title={`Copy ${candidate.name} party id`}
                      onClick={() => void copyId(candidate.partyId)}
                      className="grid w-8 shrink-0 place-items-center rounded-lg border border-border bg-surface text-fg-muted transition-colors hover:border-primary hover:text-primary"
                    >
                      <CopyIcon width={13} height={13} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {operator !== '' && (
            <div className="mt-3 rounded-lg border border-border bg-bg/40 p-2.5">
              <span className="text-[0.6rem] font-bold uppercase tracking-[0.08em] text-fg-muted">
                factory owner
              </span>
              <div className="truncate font-mono text-[0.7rem] text-fg-soft">
                {shortenParty(operator)}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setOpen(false)
              disconnect()
              toast.success('Signed out')
            }}
            className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-danger/40 bg-surface text-sm font-semibold text-danger transition-colors hover:bg-danger-soft"
          >
            <LogoutIcon width={15} height={15} />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
