import type { AnchorHTMLAttributes, ReactElement } from 'react'
import { anatomy } from '#src/components/ExplorerLink/anatomy'
import { ExternalLinkIcon } from '#src/icons'
import { cx } from '#src/utils/cx'

/**
 * Props for {@link ExplorerLink}. The label and the href are both required: the only content is an
 * `aria-hidden` icon, and a link with nowhere to go is not rendered.
 *
 * @example
 * const href = explorerLink(partyId)
 * href !== undefined && <ExplorerLink href={href} aria-label="View party id in explorer" />
 *
 * @category Components
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
 *
 * @see [anatomy.ts](https://github.com/BootNodeDev/canton-dappbooster/blob/main/canton-dappbooster/src/components/ExplorerLink/anatomy.ts) for the part classes and state attributes the theme selects.
 *
 * @category Components
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
