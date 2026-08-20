import type { HTMLAttributes, ReactElement } from 'react'
import { ExplorerLink } from '#src/components/ExplorerLink'
import { anatomy } from '#src/components/Identifier/anatomy'
import { type TruncateOptions, truncateIdentifier } from '#src/components/Identifier/truncate'
import { type CopyOutcome, type CopyState, useCopyToClipboard } from '#src/hooks/useCopyToClipboard'
import { CheckIcon, CopyIcon } from '#src/icons'
import { cx } from '#src/utils/cx'
import { SR_ONLY } from '#src/utils/srOnly'

/**
 * Props for {@link Identifier}. `label` is the accessible noun the controls are named after, and
 * `onCopy` is the clipboard outcome, not the DOM clipboard event.
 *
 * @example
 * <Identifier value={partyId} label="party id" truncate={{ head: 4, tail: 4 }} />
 */
export interface IdentifierProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'onCopy'> {
  announce?: boolean
  copy?: boolean
  href?: string
  label?: string
  onCopy?: (outcome: CopyOutcome) => void
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

/**
 * Displays a Canton identifier: truncated for reading, copyable in full, optionally linked to an
 * explorer. Copy always writes the whole value, never the truncated display value. The href is
 * built by the caller; this component composes no URLs. Renders a `span`, so it is legal anywhere
 * inline text is.
 *
 * @example
 * <Identifier value={partyId} label="party id" href={explorerLink(partyId)} announce={false} />
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
  ...rest
}: IdentifierProps): ReactElement => {
  const { state, copy: writeToClipboard } = useCopyToClipboard()

  const display = truncate === false ? value : truncateIdentifier(value, truncate)

  return (
    <span className={cx(anatomy.parts.root, className)} {...rest}>
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
