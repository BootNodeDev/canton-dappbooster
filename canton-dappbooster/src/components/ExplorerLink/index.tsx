import type { HTMLAttributes, ReactElement } from 'react'
import { ExternalLinkIcon } from '../../icons'
import { anatomy } from './anatomy'

/** Props for {@link ExplorerLink}. `href` is required: a link with nowhere to go is not rendered. */
export interface ExplorerLinkProps extends HTMLAttributes<HTMLAnchorElement> {
  href: string
}

/**
 * An icon-only external link to a block explorer. Composes no URLs — pair it with
 * {@link useExplorerLink} or {@link getExplorerLink}, which turn an identifier into an href.
 *
 * Reach for it directly when the link stands alone. Inside {@link Identifier} it is already the
 * `href` slot, so pass the href there instead of nesting one.
 *
 * Give it an `aria-label`: its only content is an `aria-hidden` icon, so without one it has no
 * accessible name.
 */
export const ExplorerLink = ({ className, href, ...rest }: ExplorerLinkProps): ReactElement => {
  return (
    <a
      className={[anatomy.parts.root, className].filter(Boolean).join(' ')}
      href={href}
      rel="noopener noreferrer"
      target="_blank"
      {...rest}
    >
      <ExternalLinkIcon />
    </a>
  )
}
