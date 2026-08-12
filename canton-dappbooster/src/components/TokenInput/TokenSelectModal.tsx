import * as dialog from '@zag-js/dialog'
import { normalizeProps, Portal, useMachine } from '@zag-js/react'
import { type ReactElement, type RefObject, useId, useRef, useState } from 'react'
import { CloseIcon } from '../../icons'
import type { Token } from '../../providers/TokenListProvider/context'
import { modalAnatomy as anatomy } from './anatomy'
import { TokenList } from './TokenList'
import { TokenSearch } from './TokenSearch'

interface TokenSelectModalProps {
  contentId: string
  onClose: () => void
  onSelect: (token: Token) => void
  open: boolean
  returnFocusTo: RefObject<HTMLElement | null>
  selectedId?: string
}

const TokenSelect = ({
  contentId,
  onClose,
  onSelect,
  returnFocusTo,
  selectedId,
}: Omit<TokenSelectModalProps, 'open'>): ReactElement => {
  const searchRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
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
          <TokenSearch onChange={setQuery} ref={searchRef} value={query} />
          <div className={anatomy.parts.favorites} />
          <TokenList
            onSelect={(token) => {
              onSelect(token)
              api.setOpen(false)
            }}
            query={query}
            selectedId={selectedId}
          />
        </div>
      </div>
    </Portal>
  )
}

/**
 * The dialog `<TokenInput>`'s token button opens
 *
 * @example
 * <TokenSelectModal contentId={selectId} onClose={() => setOpen(false)} onSelect={setToken}
 *   open={open} returnFocusTo={triggerRef} selectedId={token.id} />
 */
export const TokenSelectModal = ({ open, ...rest }: TokenSelectModalProps): ReactElement | null =>
  open ? <TokenSelect {...rest} /> : null
