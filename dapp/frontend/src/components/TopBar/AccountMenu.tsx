import { Menu } from '@ark-ui/react/menu'
import { Portal } from '@ark-ui/react/portal'
import { truncateIdentifier } from '@bootnodedev/canton-dappbooster'
import { DisconnectButton } from '@bootnodedev/canton-dappbooster/connect'
import { ChevronDown, Droplet, Power } from 'lucide-react'
import { TAP_AMOUNT } from '@/backend/commands'
import type { VestingBackend } from '@/backend/VestingBackend'
import { CopyButton } from '@/components/CopyButton'
import { PartyAvatar } from '@/components/TopBar/PartyAvatar'
import type { PartyRef } from '@/hooks/useParty'
import { useBackend } from '@/providers/Backend'
import { cn } from '@/utils/cn'
import { errorText } from '@/utils/errorText'
import { popoverClass } from '@/utils/popover'
import { toast } from '@/utils/toast'
import { AMT } from '@/utils/tokens'

const TRUNCATE = { head: 6, hint: 12, tail: 6 }

const FINGERPRINT_TRUNCATE = { head: 10, tail: 10 }

// The hint is displayed above, so the line under it carries the other half of `hint::fingerprint`.
// An id with no separator has no half to drop and is shown whole, as the kit's `partyHint` does.
const fingerprintOf = (partyId: string): string =>
  partyId.includes('::') ? partyId.slice(partyId.indexOf('::') + 2) : partyId

const triggerClass =
  'inline-flex h-11 items-center gap-2 rounded-[10px] border border-border bg-surface px-3 text-sm font-semibold text-fg transition-colors focus-visible:outline-none focus-visible:shadow-[var(--ring)]'

const ruleClass = '-mx-4 border-border'

interface AccountMenuProps {
  party: PartyRef
}

export const AccountMenu = ({ party }: AccountMenuProps): React.JSX.Element => {
  const { backend } = useBackend()

  // No store refresh follows: a tap creates an Amulet, and the store reads only the three
  // amulet-vesting templates.
  const runTap = (ledger: VestingBackend): void => {
    toast.info(`Tapping ${TAP_AMOUNT} ${AMT.symbol}…`)
    ledger.tap(party.partyId).then(
      () => toast.success(`${TAP_AMOUNT} ${AMT.symbol} tapped`),
      (err: unknown) => toast.error(errorText(err)),
    )
  }

  return (
    <Menu.Root positioning={{ placement: 'bottom-end', gutter: 6 }}>
      <Menu.Trigger className={cn(triggerClass, 'hover:border-border-strong hover:bg-muted')}>
        <PartyAvatar partyId={party.partyId} />
        {truncateIdentifier(party.partyId, TRUNCATE)}
        <ChevronDown size={14} />
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content className={cn(popoverClass, 'flex w-72 flex-col gap-4 rounded-xl p-4')}>
            <Menu.ItemGroup className="flex items-center gap-3">
              <PartyAvatar partyId={party.partyId} size={40} />
              <div className="flex min-w-0 flex-col gap-0.5">
                <Menu.ItemGroupLabel className="truncate text-sm font-semibold text-fg">
                  {party.name}
                </Menu.ItemGroupLabel>
                <p className="flex min-w-0 items-center gap-1.5 text-xs text-fg-muted">
                  <code className="truncate font-mono">
                    {truncateIdentifier(fingerprintOf(party.partyId), FINGERPRINT_TRUNCATE)}
                  </code>
                  {/* Copies the whole party id: a fingerprint on its own addresses nobody. An item
                      rather than a loose button, since a menu moves focus by arrow key and reaches
                      nothing else; `tabIndex` because a tabbable one would make Tab walk the panel
                      instead of leaving it. */}
                  <Menu.Item asChild closeOnSelect={false} value="copy-party-id">
                    <CopyButton
                      className="shrink-0"
                      tabIndex={-1}
                      label="Party id"
                      onOutcome={(outcome) => {
                        if (!outcome.ok) {
                          toast.error('Could not copy party id')
                        }
                      }}
                      size={14}
                      value={party.partyId}
                    />
                  </Menu.Item>
                </p>
              </div>
            </Menu.ItemGroup>
            <Menu.Separator className={ruleClass} />
            {/* The rule below belongs to the item: without it the two would draw an empty band. */}
            {backend !== undefined && (
              <>
                <Menu.Item
                  className="-m-4 flex cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors data-[highlighted]:bg-muted"
                  onSelect={() => runTap(backend)}
                  value="tap"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary-strong">
                    <Droplet />
                  </span>
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold text-fg">Tap {AMT.name}</span>
                    <span className="text-xs text-fg-muted">
                      Get {TAP_AMOUNT} {AMT.symbol} from the faucet
                    </span>
                  </span>
                </Menu.Item>
                <Menu.Separator className={ruleClass} />
              </>
            )}
            {/* 12px under the rule; the panel's own padding sets the space below. */}
            <div className="-mt-1 flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-xs text-fg-muted">
                <span className="size-1.5 rounded-full bg-success" />
                {/* The dot is the only sign of the connection, and colour alone carries nothing. */}
                <span className="sr-only">Connected to </span>
                {party.networkId}
              </p>
              {/* Stripped to the icon: the kit's own border and height come from the theme layer. */}
              <Menu.Item asChild value="disconnect">
                <DisconnectButton
                  aria-label="Disconnect"
                  className="h-auto border-0 bg-transparent p-0 text-fg-muted transition-colors hover:bg-transparent hover:text-danger"
                  tabIndex={-1}
                >
                  <Power />
                </DisconnectButton>
              </Menu.Item>
            </div>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  )
}
