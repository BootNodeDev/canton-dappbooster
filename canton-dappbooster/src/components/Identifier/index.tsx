import type { CSSProperties, HTMLAttributes, ReactElement, Ref } from 'react'
import { ExplorerLink } from '../../components/ExplorerLink'
import {
  type CopyOutcome,
  type CopyState,
  useCopyToClipboard,
} from '../../hooks/useCopyToClipboard'
import { CheckIcon, CopyIcon } from '../../icons'
import { anatomy } from './anatomy'
import { type TruncateOptions, truncateIdentifier } from './truncate'

/** Props for {@link Identifier}. `onCopy` is the clipboard outcome, not the DOM clipboard event. */
export interface IdentifierProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'onCopy'> {
  announce?: boolean
  copy?: boolean
  href?: string
  label?: string
  onCopy?: (outcome: CopyOutcome) => void
  ref?: Ref<HTMLSpanElement>
  truncate?: false | TruncateOptions
  value: string
}

const DEFAULT_LABEL = 'identifier'

// The outcome is otherwise carried only by the icon, which is aria-hidden.
const statusText = (state: CopyState, label: string): string => {
  if (state === 'copied') return `Copied ${label}`
  if (state === 'error') return `Could not copy ${label}`
  return ''
}

// Inline rather than themed: without CSS loaded, the outcome would land in the consumer's layout.
const SR_ONLY: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  border: 0,
  clipPath: 'inset(50%)',
}

/**
 * Displays a Canton identifier: truncated for reading, copyable in full, optionally linked to an
 * explorer. Renders a `span`, so it is legal anywhere inline text is.
 */
export const Identifier = ({
  value,
  label = DEFAULT_LABEL,
  truncate,
  copy = true,
  announce = true,
  href,
  onCopy,
  className,
  ref,
  ...rest
}: IdentifierProps): ReactElement => {
  const { state, copy: writeToClipboard } = useCopyToClipboard()

  const display = truncate === false ? value : truncateIdentifier(value, truncate)

  return (
    <span ref={ref} className={[anatomy.parts.root, className].filter(Boolean).join(' ')} {...rest}>
      {/* Titled even when untruncated: the theme also ellipsises on overflow, which JS cannot see. */}
      <code className={anatomy.parts.value} title={value}>
        {display}
      </code>
      {copy && (
        <>
          <button
            type="button"
            className={anatomy.parts.copy}
            aria-label={`Copy ${label}`}
            onClick={() => void writeToClipboard(value).then(onCopy)}
            {...{ [anatomy.states.copy]: state }}
          >
            {state === 'copied' ? <CheckIcon /> : <CopyIcon />}
          </button>
          {/* Mounted while idle: a live region must precede the change it announces. */}
          {announce && (
            <span className={anatomy.parts.status} role="status" style={SR_ONLY}>
              {statusText(state, label)}
            </span>
          )}
        </>
      )}
      {href !== undefined && (
        <ExplorerLink
          aria-label={`View ${label} in explorer`}
          className={anatomy.parts.link}
          href={href}
        />
      )}
    </span>
  )
}
