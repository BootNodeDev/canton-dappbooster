import { truncateIdentifier, useCopyToClipboard } from '@bootnodedev/canton-dappbooster'
import { DisconnectButton } from '@bootnodedev/canton-dappbooster/connect'
import { useId } from 'react'
import { PartyAvatar } from '@/components/TopBar/PartyAvatar'
import { useDismissable } from '@/hooks/useDismissable'
import type { PartyRef } from '@/hooks/useParty'
import { CaretDownIcon, CheckIcon, CopyIcon, PowerIcon } from '@/icons'
import { cn } from '@/utils/cn'
import { toast } from '@/utils/toast'

const TRUNCATE = { head: 6, hint: 12, tail: 6 }

const FINGERPRINT_TRUNCATE = { head: 10, tail: 10 }

// The hint is displayed above, so the line under it carries the other half of `hint::fingerprint`.
// An id with no separator has no half to drop and is shown whole, as the kit's `partyHint` does.
const fingerprintOf = (partyId: string): string =>
  partyId.includes('::') ? partyId.slice(partyId.indexOf('::') + 2) : partyId

const triggerClass =
  'inline-flex h-11 items-center gap-2 rounded-[10px] border border-border bg-surface px-3 text-sm font-semibold text-fg transition-colors focus-visible:outline-none focus-visible:shadow-[var(--ring)]'

interface AccountMenuProps {
  party: PartyRef
}

export const AccountMenu = ({ party }: AccountMenuProps): React.JSX.Element => {
  const { closers, keepFocus, open, root, setOpen, trigger } = useDismissable<HTMLDivElement>()
  const panelId = useId()
  const { copy, state: copyState } = useCopyToClipboard()
  const copied = copyState === 'copied'

  // The icon carries the success, but a rejected clipboard write leaves it unchanged, so the
  // failure needs its own words.
  const runCopy = (): void => {
    void copy(party.partyId).then((outcome) => {
      if (!outcome.ok) {
        toast.error('Could not copy party id')
      }
    })
  }

  return (
    <div className="relative" ref={root} {...closers}>
      <button
        aria-controls={open ? panelId : undefined}
        aria-expanded={open}
        className={cn(triggerClass, 'hover:border-border-strong hover:bg-muted')}
        onClick={() => setOpen(!open)}
        ref={trigger}
        type="button"
      >
        <PartyAvatar partyId={party.partyId} />
        {truncateIdentifier(party.partyId, TRUNCATE)}
        <CaretDownIcon width={14} height={14} />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-30 mt-1.5 flex w-72 flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-[var(--shadow-popover)]"
          id={panelId}
        >
          <div className="flex items-center gap-3">
            <PartyAvatar partyId={party.partyId} size={40} />
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="truncate text-sm font-semibold text-fg">{party.name}</p>
              <p className="flex min-w-0 items-center gap-1.5 text-xs text-fg-muted">
                <code className="truncate font-mono">
                  {truncateIdentifier(fingerprintOf(party.partyId), FINGERPRINT_TRUNCATE)}
                </code>
                {/* Copies the whole party id: a fingerprint on its own addresses nobody. */}
                <button
                  aria-label={copied ? 'Party id copied' : 'Copy party id'}
                  className="shrink-0 transition-colors hover:text-fg"
                  onClick={runCopy}
                  onMouseDown={keepFocus}
                  type="button"
                >
                  {copied ? (
                    <CheckIcon width={14} height={14} />
                  ) : (
                    <CopyIcon width={14} height={14} />
                  )}
                </button>
              </p>
            </div>
          </div>
          <hr className="-mx-4 border-border" />
          {/* 12px under the rule; the panel's own padding sets the space below. */}
          <div className="-mt-1 flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-xs text-fg-muted">
              <span className="size-1.5 rounded-full bg-success" />
              {/* The dot is the only sign of the connection, and colour alone carries nothing. */}
              <span className="sr-only">Connected to </span>
              {party.networkId}
            </p>
            {/* Stripped to the icon: the kit's own border and height come from the theme layer. */}
            <DisconnectButton
              aria-label="Disconnect"
              className="h-auto border-0 bg-transparent p-0 text-fg-muted transition-colors hover:bg-transparent hover:text-danger"
              onClick={() => setOpen(false)}
              onMouseDown={keepFocus}
            >
              <PowerIcon />
            </DisconnectButton>
          </div>
        </div>
      )}
    </div>
  )
}
