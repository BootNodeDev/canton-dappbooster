import type { AnchorHTMLAttributes, ReactElement } from 'react'
import { ExternalLinkIcon } from '../../icons'
import { cx } from '../../utils/cx'
import { anatomy } from './anatomy'

/**
 * Props for {@link ExplorerLink}. The label and the href are both required: the only content is an
 * `aria-hidden` icon, and a link with nowhere to go is not rendered.
 *
 * @example
 * <ExplorerLink href={explorerLink(partyId)} aria-label="View party id in explorer" />
 */
export interface ExplorerLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'rel' | 'target'> {
  'aria-label': string
  href: string
}

/**
 * An icon-only external link to a block explorer. Composes no URLs; pair it with `useExplorerLink`
 * or `getExplorerLink`, which turn an identifier into an href.
 *
 * Reach for it directly when the link stands alone. Inside `Identifier` it is already the `href`
 * slot, so pass the href there instead of nesting one.
 *
 * @example
 * <ExplorerLink href="https://scan.example/party/nico" aria-label="View party id in explorer" />
 */
export const ExplorerLink = ({ className, href, ...rest }: ExplorerLinkProps): ReactElement => {
  return (
    // Spread first: `rel` and `target` are the component's contract, not a consumer's to override.
    <a
      {...rest}
      className={cx(anatomy.parts.root, className)}
      href={href}
      rel="noopener noreferrer"
      target="_blank"
    >
      <ExternalLinkIcon />
    </a>
  )
}
