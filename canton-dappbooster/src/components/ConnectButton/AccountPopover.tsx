import { useConnect } from '@bootnodedev/canton-connect'
import * as popover from '@zag-js/popover'
import { mergeProps, normalizeProps, Portal, useMachine } from '@zag-js/react'
import { type ButtonHTMLAttributes, type ReactElement, type ReactNode, useId } from 'react'
import { ChevronDownIcon, LogoutIcon } from '../../icons'
import { cx } from '../../utils/cx'
import { SR_ONLY } from '../../utils/srOnly'
import { Identifier } from '../Identifier'
import { truncateIdentifier } from '../Identifier/truncate'
import { anatomy, popoverAnatomy } from './anatomy'

// The trigger sits in a header row, so the hint cannot keep the whole length a party may give it.
const HINT_LENGTH = 12

export type AccountPopoverProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  avatar?: (partyId: string) => ReactNode
  partyId: string
}

/** The component shown when connected. */
export const AccountPopover = ({
  avatar,
  className,
  partyId,
  type = 'button',
  ...rest
}: AccountPopoverProps): ReactElement => {
  const session = useConnect()
  const service = useMachine(popover.machine, {
    id: useId(),
    positioning: { gutter: 4, placement: 'bottom-end' },
  })
  const api = popover.connect(service, normalizeProps)

  const disconnect = (): void => {
    api.setOpen(false)
    void session.disconnect()
  }

  return (
    <>
      <button
        {...mergeProps(rest, api.getTriggerProps())}
        className={cx(anatomy.parts.root, className)}
        type={type}
        {...{ [anatomy.states.mode]: 'account' }}
      >
        {avatar?.(partyId)}
        <span className={anatomy.parts.party}>
          {truncateIdentifier(partyId, { hint: HINT_LENGTH })}
        </span>
        <ChevronDownIcon />
      </button>
      {api.open && (
        <Portal>
          <div {...api.getPositionerProps()} className={popoverAnatomy.parts.positioner}>
            <div {...api.getContentProps()} className={popoverAnatomy.parts.content}>
              {/* Zag names the dialog only from a rendered title, and this one has nothing to show. */}
              <h2 {...api.getTitleProps()} className={popoverAnatomy.parts.title} style={SR_ONLY}>
                Account
              </h2>
              <Identifier
                className={popoverAnatomy.parts.partyId}
                label="party id"
                value={partyId}
              />
              <button
                type="button"
                className={popoverAnatomy.parts.disconnect}
                onClick={disconnect}
              >
                <LogoutIcon />
                Disconnect
              </button>
            </div>
          </div>
        </Portal>
      )}
    </>
  )
}
