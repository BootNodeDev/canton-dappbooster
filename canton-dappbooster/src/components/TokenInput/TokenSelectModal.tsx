import * as dialog from '@zag-js/dialog'
import { normalizeProps, Portal, useMachine } from '@zag-js/react'
import { type ReactElement, useId } from 'react'
import { CloseIcon } from '../../icons'
import { modalAnatomy as anatomy } from './anatomy'

interface TokenSelectModalProps {
  onOpenChange: (open: boolean) => void
  open: boolean
}

/**
 * The dialog `<TokenInput>`'s token button opens
 *
 * @example
 * <TokenSelectModal open={open} onOpenChange={setOpen} />
 */
export const TokenSelectModal = ({
  onOpenChange,
  open,
}: TokenSelectModalProps): ReactElement | null => {
  const service = useMachine(dialog.machine, {
    id: useId(),
    onOpenChange: (details) => onOpenChange(details.open),
    open,
  })
  const api = dialog.connect(service, normalizeProps)

  return api.open ? (
    <Portal>
      <div {...api.getBackdropProps()} className={anatomy.parts.backdrop} />
      <div {...api.getPositionerProps()} className={anatomy.parts.positioner}>
        <div {...api.getContentProps()} className={anatomy.parts.content}>
          <header className={anatomy.parts.header}>
            <h2 {...api.getTitleProps()} className={anatomy.parts.title}>
              Select a token
            </h2>
            <button
              {...api.getCloseTriggerProps()}
              aria-label="Close"
              className={anatomy.parts.close}
            >
              <CloseIcon />
            </button>
          </header>
          <input
            aria-label="Search tokens"
            autoComplete="off"
            className={anatomy.parts.search}
            placeholder="Search by name or symbol"
            spellCheck={false}
            type="search"
          />
          <div className={anatomy.parts.favorites} />
          <div className={anatomy.parts.list} />
        </div>
      </div>
    </Portal>
  ) : null
}
