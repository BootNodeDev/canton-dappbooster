import { useParty } from '@bootnodedev/canton-connect'
import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react'
import { AccountPopover } from './AccountPopover'
import type { ConnectButtonMode } from './anatomy'
import { Button } from './Button'

/**
 * Props for {@link ConnectButton}.
 *
 * @example
 * <ConnectButton avatar={(partyId) => <PartyAvatar partyId={partyId} />} />
 */
export type ConnectButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  mode?: ConnectButtonMode
  avatar?: (partyId: string) => ReactNode
}

/**
 * A connect button and account dropdown.
 *
 * @example
 * <ConnectButton mode="connect" />
 * <ConnectButton>{label}</ConnectButton>
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
