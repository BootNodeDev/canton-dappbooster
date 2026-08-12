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
    onEscapeKeyDown: (event) => {
      // `input[type="search"]` clears on Escape, and the dialog dismisses on the same keydown, so
      // the field takes it first rather than a keypress meant to clear the query losing the dialog.
      if (query === '' || document.activeElement !== searchRef.current) return
      event.preventDefault()
      setQuery('')
    },
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
            // Closed through the machine, not by unmounting, so the trigger gets its focus back.
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
 * The dialog `<TokenInput>`'s token button opens. Lists what a `<TokenListProvider>` above it
 * supplies, filters it on its own search field, and closes itself on a pick, so `onSelect` only
 * has to record the choice.
 *
 * @example
 * <TokenSelectModal contentId={selectId} onClose={() => setOpen(false)} onSelect={setToken}
 *   open={open} returnFocusTo={triggerRef} selectedId={token.id} />
 */
export const TokenSelectModal = ({ open, ...rest }: TokenSelectModalProps): ReactElement | null =>
  open ? <TokenSelect {...rest} /> : null
