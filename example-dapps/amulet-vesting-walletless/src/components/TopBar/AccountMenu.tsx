import { Menu } from '@ark-ui/react/menu'
import { Portal } from '@ark-ui/react/portal'
import { truncateIdentifier } from '@bootnodedev/canton-dappbooster'
import { ChevronDown, Droplet, LogOut } from 'lucide-react'
import { TAP_AMOUNT, vesting } from '@/backend/vesting'
import { CopyButton } from '@/components/CopyButton'
import { PartyAvatar } from '@/components/TopBar/PartyAvatar'
import { useBackend } from '@/providers/Backend'
import { type Session, useSession } from '@/providers/Session'
import { cn } from '@/utils/cn'
import { errorText } from '@/utils/errorText'
import { popoverClass } from '@/utils/popover'
import { toast } from '@/utils/toast'
import { AMT } from '@/utils/tokens'

const FINGERPRINT_TRUNCATE = { head: 10, tail: 10 }

const fingerprintOf = (partyId: string): string =>
  partyId.includes('::') ? partyId.slice(partyId.indexOf('::') + 2) : partyId

const triggerClass =
  'inline-flex h-11 items-center gap-2 rounded-[10px] border border-border bg-surface px-3 text-sm font-semibold text-fg transition-colors focus-visible:outline-none focus-visible:shadow-[var(--ring)]'

const ruleClass = '-mx-4 border-border'

interface AccountMenuProps {
  session: Session
}

export const AccountMenu = ({ session }: AccountMenuProps): React.JSX.Element => {
  const { ready } = useBackend()
  const { logout } = useSession()

  const runTap = (): void => {
    toast.info(`Tapping ${TAP_AMOUNT} ${AMT.symbol}…`)
    vesting.tap().then(
      () => toast.success(`${TAP_AMOUNT} ${AMT.symbol} tapped`),
      (err: unknown) => toast.error(errorText(err)),
    )
  }

  return (
    <Menu.Root positioning={{ placement: 'bottom-end', gutter: 6 }}>
      <Menu.Trigger className={cn(triggerClass, 'hover:border-border-strong hover:bg-muted')}>
        <PartyAvatar partyId={session.partyId} />
        {session.username}
        <ChevronDown size={14} />
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content className={cn(popoverClass, 'flex w-72 flex-col gap-4 rounded-xl p-4')}>
            <Menu.ItemGroup className="flex items-center gap-3">
              <PartyAvatar partyId={session.partyId} size={40} />
              <div className="flex min-w-0 flex-col gap-0.5">
                <Menu.ItemGroupLabel className="truncate text-sm font-semibold text-fg">
                  {session.username}
                </Menu.ItemGroupLabel>
                <p className="flex min-w-0 items-center gap-1.5 text-xs text-fg-muted">
                  <code className="truncate font-mono">
                    {truncateIdentifier(fingerprintOf(session.partyId), FINGERPRINT_TRUNCATE)}
                  </code>
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
                      value={session.partyId}
                    />
                  </Menu.Item>
                </p>
              </div>
            </Menu.ItemGroup>
            <Menu.Separator className={ruleClass} />
            {ready && (
              <>
                <Menu.Item
                  className="-m-4 flex cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors data-[highlighted]:bg-muted"
                  onSelect={runTap}
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
            <Menu.Item
              className="-m-4 flex cursor-pointer items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-fg-muted transition-colors data-[highlighted]:bg-muted data-[highlighted]:text-danger"
              onSelect={() => {
                logout().catch((err: unknown) => toast.error(errorText(err)))
              }}
              value="logout"
            >
              <LogOut />
              Log out
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  )
}
