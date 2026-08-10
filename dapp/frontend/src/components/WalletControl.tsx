import { partyHint, truncateIdentifier, useCopyToClipboard } from '@bootnodedev/canton-dappbooster'
import { useEffect, useRef, useState } from 'react'
import type { PartyRef } from '@/backend/VestingBackend'
import { CheckIcon, ChevronDownIcon, CopyIcon, LogoutIcon } from '@/components/icons'
import { copyToast, toast } from '@/components/toast'
import { useConnect } from '@/hooks/useConnect'
import { useParties } from '@/hooks/useParties'
import { useParty } from '@/hooks/useParty'

// A switch row cannot use <Identifier>: its copy control would nest a button inside the switch.
const PartyRow = ({
  candidate,
  onSwitch,
}: {
  candidate: PartyRef
  onSwitch: () => void
}): React.JSX.Element => {
  const { state, copy } = useCopyToClipboard()
  return (
    <li className="flex items-stretch gap-1">
      <button
        type="button"
        onClick={onSwitch}
        className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg p-2 text-sm font-semibold text-fg transition-colors hover:bg-muted"
      >
        <span className="flex items-center gap-2">
          <span className="size-5 shrink-0 rounded-full bg-[image:var(--gradient-brand)]" />
          {candidate.name}
        </span>
        <span className="truncate font-mono text-[0.7rem] text-fg-muted">
          {truncateIdentifier(candidate.partyId)}
        </span>
      </button>
      <button
        type="button"
        aria-label={`Copy ${candidate.name} party id`}
        title={`Copy ${candidate.name} party id`}
        onClick={() => void copy(candidate.partyId).then(copyToast(`${candidate.name} party id`))}
        className="grid w-8 shrink-0 place-items-center rounded-lg border border-border bg-surface text-fg-muted transition-colors hover:border-primary hover:text-primary"
      >
        {state === 'copied' ? (
          <CheckIcon width={13} height={13} />
        ) : (
          <CopyIcon width={13} height={13} />
        )}
      </button>
    </li>
  )
}

export const WalletControl = (): React.JSX.Element | null => {
  const { connect, disconnect } = useConnect()
  const { party } = useParty()
  const { pool } = useParties()
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
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (party === undefined) {
    return null
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
        <div className="absolute right-0 z-50 mt-2 flex w-72 flex-col gap-3 rounded-xl border border-border bg-surface p-3 shadow-[var(--shadow-popover)]">
          {others.length > 0 && (
            <ul aria-label="Switch party" className="flex max-h-56 flex-col gap-1 overflow-y-auto">
              {others.map((candidate) => (
                <PartyRow
                  key={candidate.partyId}
                  candidate={candidate}
                  onSwitch={() => {
                    connect(candidate)
                    setOpen(false)
                    toast.success(`Acting as ${candidate.name}`)
                  }}
                />
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              disconnect()
              toast.success('Signed out')
            }}
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-danger/40 bg-surface text-sm font-semibold text-danger transition-colors hover:bg-danger-soft"
          >
            <LogoutIcon width={15} height={15} />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
