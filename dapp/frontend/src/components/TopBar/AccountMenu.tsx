import { Identifier, truncateIdentifier } from '@bootnodedev/canton-dappbooster'
import { DisconnectButton } from '@bootnodedev/canton-dappbooster/connect'
import { useId } from 'react'
import { PartyAvatar } from '@/components/TopBar/PartyAvatar'
import { useDismissable } from '@/hooks/useDismissable'
import type { PartyRef } from '@/hooks/useParty'
import { CaretDownIcon } from '@/icons'
import { cn } from '@/utils/cn'
import { copyToast } from '@/utils/toast'

const TRUNCATE = { head: 6, hint: 12, tail: 6 }

const triggerClass =
  'inline-flex h-11 items-center gap-2 rounded-[10px] border border-border bg-surface px-3 text-sm font-semibold text-fg transition-colors focus-visible:outline-none focus-visible:shadow-[var(--ring)]'

interface AccountMenuProps {
  party: PartyRef
}

export const AccountMenu = ({ party }: AccountMenuProps): React.JSX.Element => {
  const { closers, keepFocus, open, root, setOpen, trigger } = useDismissable<HTMLDivElement>()
  const panelId = useId()

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
          <div className="flex flex-col gap-2">
            <Identifier
              announce={false}
              className="justify-between text-sm font-semibold"
              label="party id"
              onCopy={copyToast('Party id')}
              onMouseDown={keepFocus}
              value={party.partyId}
              truncate={TRUNCATE}
            />
            <p className="flex items-center gap-2 text-xs text-fg-muted">
              <span className="size-1.5 rounded-full bg-success" />
              Connected · {party.networkId}
            </p>
          </div>
          <hr className="-mx-4 border-border" />
          <DisconnectButton
            className="w-full justify-center"
            onClick={() => setOpen(false)}
            onMouseDown={keepFocus}
          />
        </div>
      )}
    </div>
  )
}
