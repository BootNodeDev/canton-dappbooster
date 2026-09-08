import * as dialog from '@zag-js/dialog'
import { normalizeProps, Portal, useMachine } from '@zag-js/react'
import { type ReactElement, type RefObject, useId, useRef, useState } from 'react'
import { dialogAnatomy as anatomy } from '#src/components/TokenInput/anatomy'
import { TokenFavorites } from '#src/components/TokenInput/TokenFavorites'
import { TokenList } from '#src/components/TokenInput/TokenList'
import { TokenSearch } from '#src/components/TokenInput/TokenSearch'
import { CloseIcon } from '#src/icons'
import type { InstrumentId, Token } from '#src/providers/TokenListProvider/context'

interface TokenSelectDialogProps {
  contentId: string
  favoriteIds?: readonly InstrumentId[]
  onClose: () => void
  onSelect: (token: Token) => void
  open: boolean
  returnFocusTo: RefObject<HTMLElement | null>
}

const TokenSelect = ({
  contentId,
  favoriteIds,
  onClose,
  onSelect,
  returnFocusTo,
}: Omit<TokenSelectDialogProps, 'open'>): ReactElement => {
  const searchRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const service = useMachine(dialog.machine, {
    finalFocusEl: () => returnFocusTo.current,
    id: useId(),
    ids: { content: contentId },
    initialFocusEl: () => searchRef.current,
    onEscapeKeyDown: (event) => {
      // `input[type="search"]` clears on Escape and the dialog dismisses on the same keydown
      // this makes the field take it first and avoids closing the dialog
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

  // Closed through the machine, not by unmounting, so the trigger gets its focus back.
  const select = (token: Token): void => {
    onSelect(token)
    api.setOpen(false)
  }

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
          <TokenFavorites ids={favoriteIds} onSelect={select} />
          <TokenList onSelect={select} query={query} />
        </div>
      </div>
    </Portal>
  )
}

/**
 * The dialog `<TokenInput>`'s token button opens.
 *
 * @example
 * <TokenSelectDialog contentId={selectId} onClose={() => setOpen(false)} onSelect={setToken}
 *   open={open} returnFocusTo={triggerRef} />
 */
export const TokenSelectDialog = ({
  open,
  ...rest
}: TokenSelectDialogProps): ReactElement | null => (open ? <TokenSelect {...rest} /> : null)
