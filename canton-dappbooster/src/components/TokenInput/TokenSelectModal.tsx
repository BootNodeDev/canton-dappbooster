import * as dialog from '@zag-js/dialog'
import { normalizeProps, Portal, useMachine } from '@zag-js/react'
import { type ReactElement, type RefObject, useId, useRef } from 'react'
import { CloseIcon } from '../../icons'
import { modalAnatomy as anatomy } from './anatomy'

interface TokenSelectModalProps {
  contentId: string
  onClose: () => void
  open: boolean
  returnFocusTo: RefObject<HTMLElement | null>
}

const TokenSelect = ({
  contentId,
  onClose,
  returnFocusTo,
}: Omit<TokenSelectModalProps, 'open'>): ReactElement => {
  const searchRef = useRef<HTMLInputElement>(null)
  const service = useMachine(dialog.machine, {
    finalFocusEl: () => returnFocusTo.current,
    id: useId(),
    ids: { content: contentId },
    initialFocusEl: () => searchRef.current,
    onOpenChange: (details) => {
      if (!details.open) onClose()
    },
    open: true,
  })
  const api = dialog.connect(service, normalizeProps)

  return (
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
            ref={searchRef}
            spellCheck={false}
            type="search"
          />
          <div className={anatomy.parts.favorites} />
          <div className={anatomy.parts.list} />
        </div>
      </div>
    </Portal>
  )
}

/**
 * The dialog `<TokenInput>`'s token button opens
 *
 * @example
 * <TokenSelectModal contentId={selectId} onClose={() => setOpen(false)} open={open}
 *   returnFocusTo={triggerRef} />
 */
export const TokenSelectModal = ({ open, ...rest }: TokenSelectModalProps): ReactElement | null =>
  open ? <TokenSelect {...rest} /> : null
