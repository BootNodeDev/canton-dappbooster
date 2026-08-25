import { useParty } from '@bootnodedev/canton-connect'
import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react'
import { AccountPopover } from '#src/components/ConnectButton/AccountPopover'
import type { ConnectButtonMode } from '#src/components/ConnectButton/anatomy'
import { Button } from '#src/components/ConnectButton/Button'

/**
 * Props for {@link ConnectButton}.
 *
 * @example
 * <ConnectButton avatar={(partyId) => <PartyAvatar partyId={partyId} />} />
 *
 * @category Components
 */
export type ConnectButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  mode?: ConnectButtonMode
  avatar?: (partyId: string) => ReactNode
}

/**
 * One button that follows the wallet session: a connect trigger with no session, the account
 * popover with one, read from `useParty` rather than a prop so nothing can contradict a connect
 * already in flight. A `<CantonConnectProvider>` above it is required, alone among the components
 * here. `mode` pins it to one face, which renders nothing rather than the other one; `children`
 * replace the whole label, the pending copy included, so word that off `useConnect().isConnecting`.
 * Imported from `/connect`, the sub-path that pulls the Canton SDK into a consumer's graph.
 *
 * @example
 * import { ConnectButton } from '@bootnodedev/canton-dappbooster/connect'
 *
 * <ConnectButton mode="connect" />
 * <ConnectButton>{label}</ConnectButton>
 *
 * @see [anatomy.ts](https://github.com/BootNodeDev/canton-dappbooster/blob/main/canton-dappbooster/src/components/ConnectButton/anatomy.ts) for the part classes and state attributes the theme selects.
 *
 * @category Components
 */
export const ConnectButton = ({
  avatar,
  mode,
  ...rest
}: ConnectButtonProps): ReactElement | null => {
  const { isConnected, party } = useParty()
  const account = party?.partyId
  const hasAccount = isConnected && account !== undefined && account !== ''
  const showAccount = hasAccount && mode !== 'connect'
  const showConnect = !hasAccount && mode !== 'account'

  return showAccount ? (
    <AccountPopover {...rest} avatar={avatar} partyId={account} />
  ) : showConnect ? (
    <Button {...rest} />
  ) : null
}
